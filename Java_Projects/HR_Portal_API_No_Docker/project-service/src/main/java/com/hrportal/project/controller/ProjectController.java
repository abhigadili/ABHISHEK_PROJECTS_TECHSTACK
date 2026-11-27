package com.hrportal.project.controller;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.hrportal.common.web.PageRequests;
import com.hrportal.common.web.PageResponse;
import com.hrportal.project.dto.ProjectDtos.AllocationCheck;
import com.hrportal.project.dto.ProjectDtos.AllocationRequest;
import com.hrportal.project.dto.ProjectDtos.AllocationResponse;
import com.hrportal.project.dto.ProjectDtos.AllocationSummary;
import com.hrportal.project.dto.ProjectDtos.EmployeeProject;
import com.hrportal.project.dto.ProjectDtos.HistoryResponse;
import com.hrportal.project.dto.ProjectDtos.ManagerRequest;
import com.hrportal.project.dto.ProjectDtos.ProjectRequest;
import com.hrportal.project.dto.ProjectDtos.ProjectResponse;
import com.hrportal.project.dto.ProjectDtos.ProjectUpdateRequest;
import com.hrportal.project.dto.ProjectDtos.StatusRequest;
import com.hrportal.project.service.AllocationSummaryService;
import com.hrportal.project.service.ProjectService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@Tag(name = "Projects")
@RestController
@RequestMapping("/api/v1/projects")
public class ProjectController {
    private static final Set<String> SORT = Set.of("code", "name", "startDate", "endDate", "status", "createdAt");
    private final ProjectService service;
    private final AllocationSummaryService summary;

    public ProjectController(ProjectService service, AllocationSummaryService summary) {
        this.service = service;
        this.summary = summary;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('PERM_PROJECT_MANAGE')")
    @ResponseStatus(HttpStatus.CREATED)
    public ProjectResponse create(@Valid @RequestBody ProjectRequest req) {
        return service.create(req);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('PROJECT_MANAGER','HR_ADMIN','SUPER_ADMIN','FINANCE_ADMIN','MANAGER')")
    public PageResponse<ProjectResponse> list(@RequestParam(required = false) String q, @RequestParam(required = false) String status,
                                              @RequestParam(required = false) String customerId, @RequestParam(required = false) String managerId,
                                              @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
                                              @RequestParam(defaultValue = "name,asc") String sort) {
        return PageResponse.of(service.search(q, status, customerId, managerId, PageRequests.of(page, size, sort, SORT, "name")));
    }

    @GetMapping("/{id}")
    public ProjectResponse get(@PathVariable String id) {
        return service.get(id);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('PROJECT_MANAGER','HR_ADMIN','SUPER_ADMIN')")
    public ProjectResponse update(@PathVariable String id, @Valid @RequestBody ProjectUpdateRequest req) {
        return service.update(id, req);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('PROJECT_MANAGER','HR_ADMIN','SUPER_ADMIN')")
    public ProjectResponse status(@PathVariable String id, @Valid @RequestBody StatusRequest req) {
        return service.changeStatus(id, req.status(), req.reason());
    }

    @PatchMapping("/{id}/manager")
    @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
    public ProjectResponse manager(@PathVariable String id, @Valid @RequestBody ManagerRequest req) {
        return service.changeManager(id, req.projectManagerId());
    }

    @GetMapping("/{id}/history")
    @PreAuthorize("hasAnyRole('PROJECT_MANAGER','HR_ADMIN','SUPER_ADMIN','FINANCE_ADMIN')")
    public List<HistoryResponse> history(@PathVariable String id) {
        return service.history(id);
    }

    // ---- team / allocation
    @GetMapping("/{id}/allocations")
    @PreAuthorize("hasAnyRole('PROJECT_MANAGER','HR_ADMIN','SUPER_ADMIN','FINANCE_ADMIN','MANAGER')")
    public List<AllocationResponse> team(@PathVariable String id) {
        return service.team(id);
    }

    @Operation(summary = "Allocate an employee (a percentage of their time) to the project; rejects more than 100 % on any day")
    @PostMapping("/{id}/allocations")
    @PreAuthorize("hasAnyRole('PROJECT_MANAGER','HR_ADMIN','SUPER_ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public AllocationResponse allocate(@PathVariable String id, @Valid @RequestBody AllocationRequest req) {
        return service.allocate(id, req);
    }

    @PutMapping("/{id}/allocations/{allocationId}")
    @PreAuthorize("hasAnyRole('PROJECT_MANAGER','HR_ADMIN','SUPER_ADMIN')")
    public AllocationResponse updateAllocation(@PathVariable String id, @PathVariable String allocationId, @Valid @RequestBody AllocationRequest req) {
        return service.updateAllocation(id, allocationId, req);
    }

    @DeleteMapping("/{id}/allocations/{allocationId}")
    @PreAuthorize("hasAnyRole('PROJECT_MANAGER','HR_ADMIN','SUPER_ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void endAllocation(@PathVariable String id, @PathVariable String allocationId) {
        service.endAllocation(id, allocationId);
    }

    @Operation(summary = "Is the employee allocated to the project on a date? (used by the Timesheet service)")
    @GetMapping("/{id}/allocation-check")
    public AllocationCheck check(@PathVariable String id, @RequestParam String employeeId, @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.check(id, employeeId, date);
    }

    @Operation(summary = "Projects of an employee")
    @GetMapping("/employees/{employeeId}")
    public List<EmployeeProject> employeeProjects(@PathVariable String employeeId) {
        return service.employeeProjects(employeeId);
    }

    @Operation(summary = "Allocation summary of an employee on a date (stored procedure sp_employee_allocation_summary)")
    @GetMapping("/employees/{employeeId}/allocation-summary")
    public AllocationSummary allocationSummary(@PathVariable String employeeId, @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return summary.summary(employeeId, date == null ? LocalDate.now() : date);
    }
}
