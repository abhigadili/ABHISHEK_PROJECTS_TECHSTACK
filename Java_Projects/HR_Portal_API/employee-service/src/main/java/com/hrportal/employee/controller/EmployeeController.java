package com.hrportal.employee.controller;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PostAuthorize;
import org.springframework.security.access.prepost.PreAuthorize;
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

import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.security.CurrentUser;
import com.hrportal.common.web.PageRequests;
import com.hrportal.common.web.PageResponse;
import com.hrportal.employee.dto.EmployeeDtos.EmployeeRequest;
import com.hrportal.employee.dto.EmployeeDtos.EmployeeResponse;
import com.hrportal.employee.dto.EmployeeDtos.EmployeeSearchCriteria;
import com.hrportal.employee.dto.EmployeeDtos.EmployeeSummary;
import com.hrportal.employee.dto.EmployeeDtos.EmployeeUpdateRequest;
import com.hrportal.employee.dto.EmployeeDtos.LookupRequest;
import com.hrportal.employee.dto.EmployeeDtos.ManagerChangeRequest;
import com.hrportal.employee.dto.EmployeeDtos.SelfContactUpdate;
import com.hrportal.employee.dto.EmployeeDtos.StatusChangeRequest;
import com.hrportal.employee.dto.EmployeeDtos.TeamMember;
import com.hrportal.employee.dto.EmployeeDtos.TransferRequest;
import com.hrportal.employee.service.EmployeeService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@Tag(name = "Employees")
@RestController
@RequestMapping("/api/v1/employees")
public class EmployeeController {
    private static final Set<String> SORT = Set.of("firstName", "lastName", "employeeCode", "joiningDate", "status", "workEmail", "createdAt");
    private final EmployeeService service;

    public EmployeeController(EmployeeService service) {
        this.service = service;
    }

    @Operation(summary = "Onboard a new employee (HR)")
    @PostMapping
    @PreAuthorize("hasAuthority('PERM_EMPLOYEE_WRITE')")
    @ResponseStatus(HttpStatus.CREATED)
    public EmployeeResponse onboard(@Valid @RequestBody EmployeeRequest req) {
        return service.onboard(req);
    }

    @Operation(summary = "Search / filter / sort / paginate employees")
    @GetMapping
    @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN','PAYROLL_ADMIN','FINANCE_ADMIN','MANAGER','PROJECT_MANAGER')")
    public PageResponse<EmployeeResponse> search(@RequestParam(required = false) String q, @RequestParam(required = false) String status,
                                                 @RequestParam(required = false) String employmentType,
                                                 @RequestParam(required = false) String departmentId, @RequestParam(required = false) String designationId,
                                                 @RequestParam(required = false) String locationId, @RequestParam(required = false) String managerId,
                                                 @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate joinedFrom,
                                                 @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate joinedTo,
                                                 @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
                                                 @RequestParam(defaultValue = "lastName,asc") String sort) {
        EmployeeSearchCriteria c = new EmployeeSearchCriteria(q, status, employmentType, departmentId, designationId, locationId, managerId, joinedFrom, joinedTo);
        return PageResponse.of(service.search(c, PageRequests.of(page, size, sort, SORT, "lastName")));
    }

    @Operation(summary = "My own profile")
    @GetMapping("/me")
    public EmployeeResponse me() {
        String me = CurrentUser.employeeId();
        if (me == null) throw new ForbiddenOperationException("Your account is not linked to an employee record");
        return service.getProfile(me);
    }

    @Operation(summary = "Update my own contact details (self service)")
    @PutMapping("/me/contact")
    public EmployeeResponse updateMyContact(@Valid @RequestBody SelfContactUpdate req) {
        return service.updateOwnContact(req);
    }

    @Operation(summary = "Employee profile: allowed for the employee, their manager and HR / payroll / finance")
    @GetMapping("/{id}")
    @PostAuthorize("@employeeAccess.canView(returnObject)")
    public EmployeeResponse get(@PathVariable String id) {
        return service.getProfile(id);
    }

    @Operation(summary = "Non-sensitive employee summary (used by other microservices)")
    @GetMapping("/{id}/summary")
    public EmployeeSummary summary(@PathVariable String id) {
        return service.summary(id);
    }

    @Operation(summary = "Bulk summaries by id (used by other microservices)")
    @PostMapping("/lookup")
    public List<EmployeeSummary> lookup(@Valid @RequestBody LookupRequest req) {
        return service.lookup(req.ids());
    }

    @Operation(summary = "Direct reports of a manager")
    @GetMapping("/{id}/team")
    public List<TeamMember> team(@PathVariable String id) {
        return service.team(id);
    }

    @Operation(summary = "Update profile fields (HR) - partial update with optimistic locking")
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_EMPLOYEE_WRITE')")
    public EmployeeResponse update(@PathVariable String id, @Valid @RequestBody EmployeeUpdateRequest req) {
        return service.update(id, req);
    }

    @Operation(summary = "Change employment status (ACTIVE, INACTIVE, ON_NOTICE, RESIGNED, TERMINATED)")
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAuthority('PERM_EMPLOYEE_WRITE')")
    public EmployeeResponse status(@PathVariable String id, @Valid @RequestBody StatusChangeRequest req) {
        return service.changeStatus(id, req);
    }

    @Operation(summary = "Assign / change the reporting manager")
    @PatchMapping("/{id}/manager")
    @PreAuthorize("hasAuthority('PERM_EMPLOYEE_WRITE')")
    public EmployeeResponse manager(@PathVariable String id, @Valid @RequestBody ManagerChangeRequest req) {
        return service.changeManager(id, req);
    }

    @Operation(summary = "Transfer / promote: department, designation, location, job grade")
    @PatchMapping("/{id}/transfer")
    @PreAuthorize("hasAuthority('PERM_EMPLOYEE_WRITE')")
    public EmployeeResponse transfer(@PathVariable String id, @Valid @RequestBody TransferRequest req) {
        return service.transfer(id, req);
    }
}
