package com.hrportal.organization.controller;

import java.util.List;
import java.util.Set;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.hrportal.common.web.PageRequests;
import com.hrportal.common.web.PageResponse;
import com.hrportal.organization.dto.OrgDtos.ChainLink;
import com.hrportal.organization.dto.OrgDtos.DepartmentHeadcount;
import com.hrportal.organization.dto.OrgDtos.DepartmentResponse;
import com.hrportal.organization.dto.OrgDtos.DepartmentTreeNode;
import com.hrportal.organization.dto.OrgDtos.EmployeeNodeResponse;
import com.hrportal.organization.dto.OrgDtos.HeadRequest;
import com.hrportal.organization.dto.OrgDtos.OrgChartNode;
import com.hrportal.organization.service.OrgStructureService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@Tag(name = "Organization Structure")
@RestController
@RequestMapping("/api/v1/organization")
public class OrgStructureController {
    private static final Set<String> NODE_SORT = Set.of("fullName", "employeeCode", "joiningDate", "status");
    private final OrgStructureService service;

    public OrgStructureController(OrgStructureService service) {
        this.service = service;
    }

    @Operation(summary = "Department hierarchy with active headcount")
    @GetMapping("/departments/tree")
    public List<DepartmentTreeNode> departmentTree() {
        return service.departmentTree();
    }

    @Operation(summary = "Employees of a department (read model fed by employee events)")
    @GetMapping("/departments/{id}/employees")
    @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN','MANAGER','PROJECT_MANAGER','FINANCE_ADMIN','PAYROLL_ADMIN')")
    public PageResponse<EmployeeNodeResponse> departmentEmployees(@PathVariable String id, @RequestParam(defaultValue = "0") int page,
                                                                  @RequestParam(defaultValue = "20") int size,
                                                                  @RequestParam(required = false) String sort) {
        return PageResponse.of(service.departmentEmployees(id, PageRequests.of(page, size, sort, NODE_SORT, "fullName")));
    }

    @Operation(summary = "Assign the head (manager) of a department")
    @PutMapping("/departments/{id}/head")
    @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
    public DepartmentResponse assignHead(@PathVariable String id, @Valid @RequestBody HeadRequest req) {
        return service.assignHead(id, req.headEmployeeId());
    }

    @Operation(summary = "Headcount per department ranked with a SQL window function")
    @GetMapping("/departments/headcount")
    @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN','FINANCE_ADMIN','MANAGER')")
    public List<DepartmentHeadcount> headcount() {
        return service.headcount();
    }

    @Operation(summary = "Organization chart of the whole company as a hierarchy")
    @GetMapping("/chart")
    public List<OrgChartNode> chart() {
        return service.companyChart();
    }

    @Operation(summary = "Organization chart below one employee")
    @GetMapping("/chart/{employeeId}")
    public OrgChartNode chartFor(@PathVariable String employeeId) {
        return service.chartFor(employeeId);
    }

    @Operation(summary = "Reporting-manager chain upwards (recursive CTE)")
    @GetMapping("/employees/{employeeId}/reporting-chain")
    public List<ChainLink> chain(@PathVariable String employeeId) {
        return service.reportingChain(employeeId);
    }

    @Operation(summary = "Direct and indirect reports (recursive CTE)")
    @GetMapping("/employees/{employeeId}/subordinates")
    @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN','MANAGER','PROJECT_MANAGER') or @authz.isSelf(#employeeId)")
    public List<ChainLink> subordinates(@PathVariable String employeeId, @RequestParam(defaultValue = "5") int depth) {
        return service.subordinates(employeeId, depth);
    }
}
