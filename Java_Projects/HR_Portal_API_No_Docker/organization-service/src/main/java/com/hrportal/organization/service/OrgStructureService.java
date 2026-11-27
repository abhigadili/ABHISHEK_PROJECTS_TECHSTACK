package com.hrportal.organization.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.common.audit.AuditService;
import com.hrportal.common.cache.CacheEvictor;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.common.persistence.BeanMapper;
import com.hrportal.organization.dto.OrgDtos.ChainLink;
import com.hrportal.organization.dto.OrgDtos.DepartmentHeadcount;
import com.hrportal.organization.dto.OrgDtos.DepartmentResponse;
import com.hrportal.organization.dto.OrgDtos.DepartmentTreeNode;
import com.hrportal.organization.dto.OrgDtos.EmployeeNodeResponse;
import com.hrportal.organization.dto.OrgDtos.OrgChartNode;
import com.hrportal.organization.entity.Department;
import com.hrportal.organization.entity.Designation;
import com.hrportal.organization.entity.OrgEmployeeNode;
import com.hrportal.organization.repository.DepartmentRepository;
import com.hrportal.organization.repository.DesignationRepository;
import com.hrportal.organization.repository.OrgEmployeeNodeRepository;

/** Organizational structure: department tree, organization chart, department employee listing, manager (head) assignment. */
@Service
@Transactional(readOnly = true)
public class OrgStructureService {
    private static final Set<String> GONE = Set.of("RESIGNED", "TERMINATED");

    private final DepartmentRepository departments;
    private final DesignationRepository designations;
    private final OrgEmployeeNodeRepository nodes;
    private final OrgHierarchyJdbc hierarchy;
    private final AuditService audit;
    private final CacheEvictor cache;

    public OrgStructureService(DepartmentRepository departments, DesignationRepository designations, OrgEmployeeNodeRepository nodes,
                               OrgHierarchyJdbc hierarchy, AuditService audit, CacheEvictor cache) {
        this.departments = departments;
        this.designations = designations;
        this.nodes = nodes;
        this.hierarchy = hierarchy;
        this.audit = audit;
        this.cache = cache;
    }

    /** Departments as a tree (children grouped by parent id with a stream collector; roots have no parent). */
    @Cacheable(cacheNames = "departmentTree", key = "'all'")
    public List<DepartmentTreeNode> departmentTree() {
        List<Department> all = departments.findAll();
        Map<String, Long> counts = hierarchy.activeCountsByDepartment();
        Map<String, List<Department>> byParent = all.stream().filter(d -> d.getParentId() != null)
                .collect(Collectors.groupingBy(Department::getParentId));
        Set<String> ids = all.stream().map(Department::getId).collect(Collectors.toSet());
        return all.stream().filter(d -> d.getParentId() == null || !ids.contains(d.getParentId()))
                .sorted(Comparator.comparing(Department::getName))
                .map(d -> toTree(d, byParent, counts, new HashSet<>())).toList();
    }

    private DepartmentTreeNode toTree(Department d, Map<String, List<Department>> byParent, Map<String, Long> counts, Set<String> seen) {
        List<DepartmentTreeNode> children = new ArrayList<>();
        if (seen.add(d.getId())) {
            for (Department c : byParent.getOrDefault(d.getId(), List.of()).stream().sorted(Comparator.comparing(Department::getName)).toList()) {
                children.add(toTree(c, byParent, counts, seen));
            }
        }
        return new DepartmentTreeNode(d.getId(), d.getCode(), d.getName(), d.getHeadEmployeeId(), counts.getOrDefault(d.getId(), 0L), children);
    }

    /** Whole company chart: roots are employees without a (known, active) manager. */
    @Cacheable(cacheNames = "orgChart", key = "'company'")
    public List<OrgChartNode> companyChart() {
        List<OrgEmployeeNode> all = nodes.findByStatusNot("TERMINATED").stream().filter(n -> !GONE.contains(n.getStatus())).toList();
        Chart chart = new Chart(all);
        Set<String> ids = all.stream().map(OrgEmployeeNode::getEmployeeId).collect(Collectors.toSet());
        return all.stream().filter(n -> n.getManagerId() == null || !ids.contains(n.getManagerId()))
                .sorted(Comparator.comparing(OrgEmployeeNode::getFullName))
                .map(n -> chart.build(n, new HashSet<>())).toList();
    }

    /** Chart rooted at one employee. */
    @Cacheable(cacheNames = "orgChart", key = "#employeeId")
    public OrgChartNode chartFor(String employeeId) {
        OrgEmployeeNode root = nodes.findById(employeeId).orElseThrow(() -> ResourceNotFoundException.of("Employee node", employeeId));
        List<OrgEmployeeNode> all = nodes.findAll().stream().filter(n -> !GONE.contains(n.getStatus())).toList();
        return new Chart(all).build(root, new HashSet<>());
    }

    public List<ChainLink> reportingChain(String employeeId) {
        List<ChainLink> chain = hierarchy.reportingChain(employeeId);
        if (chain.isEmpty()) throw ResourceNotFoundException.of("Employee node", employeeId);
        return chain;
    }

    public List<ChainLink> subordinates(String employeeId, int depth) {
        if (depth < 1 || depth > 10) throw new BadRequestException("depth must be between 1 and 10");
        return hierarchy.subordinates(employeeId, depth);
    }

    public Page<EmployeeNodeResponse> departmentEmployees(String departmentId, Pageable pageable) {
        if (!departments.existsById(departmentId)) throw ResourceNotFoundException.of("Department", departmentId);
        return nodes.findByDepartmentId(departmentId, pageable).map(n -> BeanMapper.toRecord(n, EmployeeNodeResponse.class));
    }

    public List<DepartmentHeadcount> headcount() {
        return hierarchy.headcountByDepartment();
    }

    /** Manager assignment on the organization side: who heads a department. */
    @Transactional
    public DepartmentResponse assignHead(String departmentId, String headEmployeeId) {
        Department d = departments.findById(departmentId).orElseThrow(() -> ResourceNotFoundException.of("Department", departmentId));
        if (!nodes.existsById(headEmployeeId)) throw new BadRequestException("Unknown employee: " + headEmployeeId);
        String before = d.getHeadEmployeeId();
        d.setHeadEmployeeId(headEmployeeId);
        departments.save(d);
        cache.evict("departments", departmentId);
        cache.clear("departmentTree");
        audit.record("Department", departmentId, "HEAD_ASSIGNED", before, headEmployeeId);
        return BeanMapper.toRecord(d, DepartmentResponse.class);
    }

    /** In-memory chart assembly: nodes grouped by manager id (HashMap of lists), names looked up once. */
    private final class Chart {
        private final Map<String, List<OrgEmployeeNode>> byManager;
        private final Map<String, String> designationNames = new HashMap<>();
        private final Map<String, String> departmentNames = new HashMap<>();

        Chart(List<OrgEmployeeNode> all) {
            this.byManager = all.stream().filter(n -> n.getManagerId() != null).collect(Collectors.groupingBy(OrgEmployeeNode::getManagerId));
            designations.findAll().forEach((Designation d) -> designationNames.put(d.getId(), d.getTitle()));
            departments.findAll().forEach(d -> departmentNames.put(d.getId(), d.getName()));
        }

        OrgChartNode build(OrgEmployeeNode n, Set<String> path) {
            List<OrgChartNode> reports = new ArrayList<>();
            if (path.add(n.getEmployeeId())) {                     // cycle guard: never revisit a node on the current path
                TreeMap<String, OrgEmployeeNode> sorted = new TreeMap<>();
                for (OrgEmployeeNode c : byManager.getOrDefault(n.getEmployeeId(), List.of())) sorted.put(c.getFullName() + c.getEmployeeId(), c);
                sorted.values().forEach(c -> reports.add(build(c, path)));
                path.remove(n.getEmployeeId());
            }
            return new OrgChartNode(n.getEmployeeId(), n.getEmployeeCode(), n.getFullName(), designationNames.get(n.getDesignationId()),
                    departmentNames.get(n.getDepartmentId()), n.getStatus(), reports.size(), reports);
        }
    }
}
