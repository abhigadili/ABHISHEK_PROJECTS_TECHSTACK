package com.hrportal.employee.controller;

import java.util.List;
import java.util.Set;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.hrportal.common.web.PageRequests;
import com.hrportal.common.web.PageResponse;
import com.hrportal.employee.dto.EmployeeDtos.DepartmentStatusCount;
import com.hrportal.employee.dto.EmployeeDtos.DirectoryEntry;
import com.hrportal.employee.dto.EmployeeDtos.DirectoryGroups;
import com.hrportal.employee.dto.EmployeeDtos.ManagerSpan;
import com.hrportal.employee.service.DirectoryService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "Employee Directory")
@RestController
@RequestMapping("/api/v1/employees")
public class DirectoryController {
    private static final Set<String> SORT = Set.of("firstName", "lastName", "employeeCode", "workEmail");
    private final DirectoryService service;

    public DirectoryController(DirectoryService service) {
        this.service = service;
    }

    @Operation(summary = "Company directory (non-sensitive columns only; cached in Redis)")
    @GetMapping("/directory")
    public PageResponse<DirectoryEntry> directory(@RequestParam(required = false) String q, @RequestParam(defaultValue = "0") int page,
                                                  @RequestParam(defaultValue = "20") int size, @RequestParam(defaultValue = "firstName,asc") String sort) {
        return service.directory(q, PageRequests.of(page, size, sort, SORT, "firstName"));
    }

    @Operation(summary = "Directory grouped alphabetically with status counts")
    @GetMapping("/directory/grouped")
    public DirectoryGroups grouped() {
        return service.grouped();
    }

    @Operation(summary = "Headcount by department and status (Criteria API)")
    @GetMapping("/analytics/headcount")
    @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN','FINANCE_ADMIN')")
    public List<DepartmentStatusCount> headcount() {
        return service.headcount();
    }

    @Operation(summary = "Managers ranked by number of active direct reports")
    @GetMapping("/analytics/span-of-control")
    @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
    public List<ManagerSpan> span(@RequestParam(defaultValue = "10") int limit) {
        return service.spanOfControl(limit);
    }
}
