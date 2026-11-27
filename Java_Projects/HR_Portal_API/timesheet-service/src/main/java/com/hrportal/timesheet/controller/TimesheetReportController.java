package com.hrportal.timesheet.controller;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.hrportal.timesheet.dto.TimesheetDtos.EmployeeHoursSummary;
import com.hrportal.timesheet.dto.TimesheetDtos.ProjectHoursSummary;
import com.hrportal.timesheet.dto.TimesheetDtos.TaskRequest;
import com.hrportal.timesheet.dto.TimesheetDtos.TaskResponse;
import com.hrportal.timesheet.service.TaskService;
import com.hrportal.timesheet.service.TimesheetReportService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@Tag(name = "Timesheet Reports and Tasks")
@RestController
@RequestMapping("/api/v1/timesheets")
public class TimesheetReportController {
    private final TimesheetReportService reports;
    private final TaskService tasks;

    public TimesheetReportController(TimesheetReportService reports, TaskService tasks) {
        this.reports = reports;
        this.tasks = tasks;
    }

    @Operation(summary = "Employee work-hour summary (approved hours, billable vs non-billable, per project) - stored procedure")
    @GetMapping("/reports/employee/{employeeId}")
    public EmployeeHoursSummary employee(@PathVariable String employeeId, @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                         @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return reports.employee(employeeId, from, to);
    }

    @Operation(summary = "Project work-hour summary per employee")
    @GetMapping("/reports/project/{projectId}")
    @PreAuthorize("hasAnyRole('PROJECT_MANAGER','HR_ADMIN','SUPER_ADMIN','FINANCE_ADMIN')")
    public ProjectHoursSummary project(@PathVariable String projectId, @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                       @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return reports.project(projectId, from, to);
    }

    @GetMapping("/tasks")
    public List<TaskResponse> tasks(@RequestParam String projectId) {
        return tasks.forProject(projectId);
    }

    @PostMapping("/tasks")
    @PreAuthorize("hasAuthority('PERM_PROJECT_MANAGE')")
    @ResponseStatus(HttpStatus.CREATED)
    public TaskResponse createTask(@Valid @RequestBody TaskRequest req) {
        return tasks.create(req);
    }

    @PutMapping("/tasks/{id}")
    @PreAuthorize("hasAuthority('PERM_PROJECT_MANAGE')")
    public TaskResponse updateTask(@PathVariable String id, @Valid @RequestBody TaskRequest req) {
        return tasks.update(id, req);
    }
}
