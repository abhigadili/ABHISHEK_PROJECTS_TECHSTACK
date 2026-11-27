package com.hrportal.project.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.common.audit.AuditService;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ConflictException;
import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.common.exception.ServiceUnavailableException;
import com.hrportal.common.persistence.BeanMapper;
import com.hrportal.common.security.CurrentUser;
import com.hrportal.common.security.Role;
import com.hrportal.project.client.EmployeeClient;
import com.hrportal.project.client.EmployeeClient.EmployeeInfo;
import com.hrportal.project.dto.ProjectDtos.AllocationCheck;
import com.hrportal.project.dto.ProjectDtos.AllocationRequest;
import com.hrportal.project.dto.ProjectDtos.AllocationResponse;
import com.hrportal.project.dto.ProjectDtos.EmployeeProject;
import com.hrportal.project.dto.ProjectDtos.HistoryResponse;
import com.hrportal.project.dto.ProjectDtos.ProjectRequest;
import com.hrportal.project.dto.ProjectDtos.ProjectResponse;
import com.hrportal.project.dto.ProjectDtos.ProjectUpdateRequest;
import com.hrportal.project.entity.Enums.AllocationStatus;
import com.hrportal.project.entity.Enums.ProjectStatus;
import com.hrportal.project.entity.Project;
import com.hrportal.project.entity.ProjectAllocation;
import com.hrportal.project.entity.ProjectHistory;
import com.hrportal.project.producer.ProjectEventProducer;
import com.hrportal.project.repository.ProjectRepositories.AllocationRepository;
import com.hrportal.project.repository.ProjectRepositories.CustomerRepository;
import com.hrportal.project.repository.ProjectRepositories.HistoryRepository;
import com.hrportal.project.repository.ProjectRepositories.ProjectRepository;

import feign.FeignException;
import jakarta.persistence.criteria.Predicate;

/** Projects, team allocation and the project history. A project manager may only manage the projects they own. */
@Service
@Transactional
public class ProjectService {
    private static final java.util.Set<ProjectStatus> ORDER_FROM_PLANNED = java.util.EnumSet.of(ProjectStatus.ACTIVE, ProjectStatus.CANCELLED);

    private final ProjectRepository projects;
    private final CustomerRepository customers;
    private final AllocationRepository allocations;
    private final HistoryRepository history;
    private final EmployeeClient employeeClient;
    private final ProjectEventProducer producer;
    private final AuditService audit;

    public ProjectService(ProjectRepository projects, CustomerRepository customers, AllocationRepository allocations, HistoryRepository history,
                          EmployeeClient employeeClient, ProjectEventProducer producer, AuditService audit) {
        this.projects = projects;
        this.customers = customers;
        this.allocations = allocations;
        this.history = history;
        this.employeeClient = employeeClient;
        this.producer = producer;
        this.audit = audit;
    }

    // ------------------------------------------------------------------ projects
    public ProjectResponse create(ProjectRequest req) {
        if (projects.existsByCodeIgnoreCase(req.code())) throw new ConflictException("Project code already exists: " + req.code());
        if (!customers.existsById(req.customerId())) throw new BadRequestException("Unknown customer: " + req.customerId());
        requireActiveEmployee(req.projectManagerId());
        Project p = BeanMapper.toEntity(req, Project.class);
        p.setCode(req.code().toUpperCase());
        p = projects.save(p);
        log(p.getId(), "CREATED", null, p.getCode());
        audit.record("Project", p.getId(), "CREATED", toResponse(p));
        return toResponse(p);
    }

    public ProjectResponse update(String id, ProjectUpdateRequest req) {
        Project p = find(id);
        requireManage(p);
        if (p.getStatus().isClosed()) throw new BadRequestException("A " + p.getStatus() + " project cannot be changed");
        ProjectResponse before = toResponse(p);
        BeanMapper.copyNonNull(req, p);
        if (p.getEndDate() != null && p.getEndDate().isBefore(p.getStartDate())) throw new BadRequestException("endDate must not be before startDate");
        projects.saveAndFlush(p);
        if (req.budget() != null && before.budget() != null && req.budget().compareTo(before.budget()) != 0) log(id, "BUDGET_CHANGED", before.budget().toPlainString(), req.budget().toPlainString());
        if (req.endDate() != null && !req.endDate().equals(before.endDate())) log(id, "END_DATE_CHANGED", String.valueOf(before.endDate()), req.endDate().toString());
        audit.record("Project", id, "UPDATED", before, toResponse(p));
        return toResponse(p);
    }

    public ProjectResponse changeStatus(String id, String statusText, String reason) {
        Project p = find(id);
        requireManage(p);
        ProjectStatus target = ProjectStatus.valueOf(statusText);
        ProjectStatus current = p.getStatus();
        if (current == target) throw new BadRequestException("Project is already " + target);
        if (current.isClosed()) throw new BadRequestException("A " + current + " project cannot change status");
        if (current == ProjectStatus.PLANNED && !ORDER_FROM_PLANNED.contains(target)) throw new BadRequestException("A PLANNED project can only become ACTIVE or CANCELLED");
        p.setStatus(target);
        projects.save(p);
        if (target.isClosed()) endAllocations(p, "Project " + target);
        log(id, "STATUS_CHANGED", current.name(), target + (reason == null ? "" : " (" + reason + ")"));
        audit.record("Project", id, "STATUS_CHANGED", current.name(), target.name());
        return toResponse(p);
    }

    public ProjectResponse changeManager(String id, String managerId) {
        Project p = find(id);
        if (!CurrentUser.hasAnyRole(Role.SUPER_ADMIN, Role.HR_ADMIN)) throw new ForbiddenOperationException("Only HR or a super admin can reassign the project manager");
        requireActiveEmployee(managerId);
        String old = p.getProjectManagerId();
        p.setProjectManagerId(managerId);
        projects.save(p);
        log(id, "MANAGER_CHANGED", old, managerId);
        audit.record("Project", id, "MANAGER_CHANGED", old, managerId);
        return toResponse(p);
    }

    @Transactional(readOnly = true)
    public ProjectResponse get(String id) {
        return toResponse(find(id));
    }

    @Transactional(readOnly = true)
    public Page<ProjectResponse> search(String q, String status, String customerId, String managerId, Pageable pageable) {
        Specification<Project> spec = (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                String like = "%" + q.trim().toLowerCase().replace("%", "").replace("_", "") + "%";
                p.add(cb.or(cb.like(cb.lower(root.get("name")), like), cb.like(cb.lower(root.get("code")), like)));
            }
            if (status != null) p.add(cb.equal(root.get("status"), ProjectStatus.valueOf(status)));
            if (customerId != null) p.add(cb.equal(root.get("customerId"), customerId));
            if (managerId != null) p.add(cb.equal(root.get("projectManagerId"), managerId));
            return cb.and(p.toArray(new Predicate[0]));
        };
        return projects.findAll(spec, pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public List<HistoryResponse> history(String id) {
        find(id);
        return BeanMapper.toRecords(history.findByProjectIdOrderByCreatedAtDesc(id), HistoryResponse.class);
    }

    // ------------------------------------------------------------------ allocations
    public AllocationResponse allocate(String projectId, AllocationRequest req) {
        Project p = find(projectId);
        requireManage(p);
        if (p.getStatus().isClosed()) throw new BadRequestException("Cannot allocate people to a " + p.getStatus() + " project");
        EmployeeInfo emp = requireActiveEmployee(req.employeeId());
        LocalDate end = req.endDate() == null ? p.getEndDate() : req.endDate();
        if (req.startDate().isBefore(p.getStartDate())) throw new BadRequestException("Allocation cannot start before the project start date");
        if (end != null && p.getEndDate() != null && end.isAfter(p.getEndDate())) throw new BadRequestException("Allocation cannot end after the project end date");
        checkCapacity(req.employeeId(), req.startDate(), end, req.allocationPercent(), null);
        ProjectAllocation a = BeanMapper.toEntity(req, ProjectAllocation.class);
        a.setProjectId(projectId);
        a.setEmployeeName(emp.fullName());
        if (a.getEndDate() == null) a.setEndDate(end);
        a = allocations.save(a);
        log(projectId, "ALLOCATED", null, req.employeeId() + " " + req.allocationPercent() + "%");
        producer.allocationChanged(p, a, "CREATED");
        audit.record("ProjectAllocation", a.getId(), "CREATED", BeanMapper.toRecord(a, AllocationResponse.class));
        return BeanMapper.toRecord(a, AllocationResponse.class);
    }

    public AllocationResponse updateAllocation(String projectId, String allocationId, AllocationRequest req) {
        Project p = find(projectId);
        requireManage(p);
        ProjectAllocation a = allocations.findById(allocationId).filter(x -> x.getProjectId().equals(projectId))
                .orElseThrow(() -> ResourceNotFoundException.of("Allocation", allocationId));
        if (a.getStatus() == AllocationStatus.ENDED) throw new BadRequestException("The allocation has ended");
        LocalDate end = req.endDate() == null ? a.getEndDate() : req.endDate();
        checkCapacity(a.getEmployeeId(), req.startDate(), end, req.allocationPercent(), a.getId());
        AllocationResponse before = BeanMapper.toRecord(a, AllocationResponse.class);
        a.setRole(req.role());
        a.setAllocationPercent(req.allocationPercent());
        a.setStartDate(req.startDate());
        a.setEndDate(end);
        if (req.billable() != null) a.setBillable(req.billable());
        a = allocations.save(a);
        log(projectId, "ALLOCATION_CHANGED", before.allocationPercent() + "%", req.allocationPercent() + "% for " + a.getEmployeeId());
        producer.allocationChanged(p, a, "UPDATED");
        audit.record("ProjectAllocation", a.getId(), "UPDATED", before, BeanMapper.toRecord(a, AllocationResponse.class));
        return BeanMapper.toRecord(a, AllocationResponse.class);
    }

    public void endAllocation(String projectId, String allocationId) {
        Project p = find(projectId);
        requireManage(p);
        ProjectAllocation a = allocations.findById(allocationId).filter(x -> x.getProjectId().equals(projectId))
                .orElseThrow(() -> ResourceNotFoundException.of("Allocation", allocationId));
        endOne(p, a, "UPDATED");
        log(projectId, "ALLOCATION_ENDED", a.getEmployeeId(), null);
    }

    /** Called when an employee leaves: every live allocation ends today (no human caller). */
    public void endAllocationsOfEmployee(String employeeId) {
        for (ProjectAllocation a : allocations.findByEmployeeIdAndStatus(employeeId, AllocationStatus.ACTIVE)) {
            projects.findById(a.getProjectId()).ifPresent(p -> {
                endOne(p, a, "ENDED");
                log(p.getId(), "ALLOCATION_ENDED", employeeId, "Employee left the company");
            });
        }
    }

    private void endOne(Project p, ProjectAllocation a, String action) {
        a.setStatus(AllocationStatus.ENDED);
        if (a.getEndDate() == null || a.getEndDate().isAfter(LocalDate.now())) a.setEndDate(LocalDate.now());
        allocations.save(a);
        producer.allocationChanged(p, a, action.equals("ENDED") ? "ENDED" : "ENDED");
        audit.record("ProjectAllocation", a.getId(), "ENDED", a.getEmployeeId());
    }

    private void endAllocations(Project p, String reason) {
        allocations.findByProjectIdAndStatus(p.getId(), AllocationStatus.ACTIVE).forEach(a -> endOne(p, a, "ENDED"));
    }

    /** No employee may exceed 100 % of their time on any day: peak concurrent load of existing + new allocation. */
    private void checkCapacity(String employeeId, LocalDate from, LocalDate to, java.math.BigDecimal percent, String excludeId) {
        LocalDate horizon = to == null ? from.plusYears(5) : to;
        List<ProjectAllocation> overlapping = allocations.findOverlapping(employeeId, from, horizon, excludeId);
        java.math.BigDecimal peak = AllocationCalculator.peakLoad(overlapping, percent, from, horizon);
        if (peak.compareTo(java.math.BigDecimal.valueOf(100)) > 0) {
            throw new BadRequestException("Allocation would put the employee at " + peak.stripTrailingZeros().toPlainString() + "% of their time (maximum 100%)");
        }
    }

    @Transactional(readOnly = true)
    public List<AllocationResponse> team(String projectId) {
        find(projectId);
        return BeanMapper.toRecords(allocations.findByProjectIdOrderByStartDateDesc(projectId), AllocationResponse.class);
    }

    /** All projects an employee is (or was) allocated to, with the allocation details (one query for the projects, no N+1). */
    @Transactional(readOnly = true)
    public List<EmployeeProject> employeeProjects(String employeeId) {
        requireSelfOrManager(employeeId);
        List<ProjectAllocation> list = allocations.findByEmployeeIdOrderByStartDateDesc(employeeId);
        Map<String, Project> byId = projects.findByIdIn(list.stream().map(ProjectAllocation::getProjectId).collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(Project::getId, Function.identity()));
        return list.stream().filter(a -> byId.containsKey(a.getProjectId())).map(a -> {
            Project p = byId.get(a.getProjectId());
            return new EmployeeProject(p.getId(), p.getCode(), p.getName(), p.getStatus().name(), p.getCustomerId(), a.getRole(), a.getAllocationPercent(),
                    a.getStartDate(), a.getEndDate(), a.isBillable(), a.getStatus().name());
        }).sorted(Comparator.comparing(EmployeeProject::startDate).reversed()).toList();
    }

    /** Used by the Timesheet service before it accepts hours. */
    @Transactional(readOnly = true)
    public AllocationCheck check(String projectId, String employeeId, LocalDate date) {
        Project p = find(projectId);
        return allocations.findActiveOn(employeeId, projectId, date)
                .map(a -> new AllocationCheck(projectId, employeeId, date, true, a.getAllocationPercent(), a.isBillable(), p.getStatus().name(), p.getProjectManagerId()))
                .orElseGet(() -> new AllocationCheck(projectId, employeeId, date, false, java.math.BigDecimal.ZERO, false, p.getStatus().name(), p.getProjectManagerId()));
    }

    // ------------------------------------------------------------------ helpers
    private void requireManage(Project p) {
        if (CurrentUser.hasAnyRole(Role.SUPER_ADMIN, Role.HR_ADMIN)) return;
        if (CurrentUser.hasRole(Role.PROJECT_MANAGER) && p.getProjectManagerId().equals(CurrentUser.employeeId())) return;
        throw new ForbiddenOperationException("Only the project manager of this project (or HR) can change it");
    }

    private void requireSelfOrManager(String employeeId) {
        if (CurrentUser.hasAnyRole(Role.SUPER_ADMIN, Role.HR_ADMIN, Role.PROJECT_MANAGER, Role.MANAGER, Role.FINANCE_ADMIN)) return;
        if (employeeId.equals(CurrentUser.employeeId())) return;
        throw new ForbiddenOperationException("You can only view your own projects");
    }

    private EmployeeInfo requireActiveEmployee(String employeeId) {
        try {
            EmployeeInfo e = employeeClient.summary(employeeId);
            if ("RESIGNED".equals(e.status()) || "TERMINATED".equals(e.status())) throw new BadRequestException("Employee is no longer active: " + employeeId);
            return e;
        } catch (ResourceNotFoundException e) {
            throw new BadRequestException("Unknown employee: " + employeeId);
        } catch (FeignException e) {
            throw new ServiceUnavailableException("Employee service is unavailable");
        }
    }

    private void log(String projectId, String type, String oldValue, String newValue) {
        ProjectHistory h = new ProjectHistory();
        h.setProjectId(projectId);
        h.setChangeType(type);
        h.setOldValue(oldValue);
        h.setNewValue(newValue);
        history.save(h);
    }

    private Project find(String id) {
        return projects.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Project", id));
    }

    private ProjectResponse toResponse(Project p) {
        return BeanMapper.toRecord(p, ProjectResponse.class);
    }
}
