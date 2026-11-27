package com.hrportal.reporting.controller;

import java.util.Map;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.hrportal.reporting.service.DashboardService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "Dashboards")
@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {
    private final DashboardService service;

    public DashboardController(DashboardService service) {
        this.service = service;
    }

    @Operation(summary = "Employee dashboard: profile, leave balance, holidays, attendance, timesheets, payslip, pending items, review status, events (9 services concurrently)")
    @GetMapping("/employee")
    public Map<String, Object> employee() {
        return service.employeeDashboard();
    }

    @Operation(summary = "Manager dashboard: team, pending leave / timesheet approvals, team attendance, upcoming reviews, team project allocation")
    @GetMapping("/manager")
    @PreAuthorize("hasAnyRole('MANAGER','HR_ADMIN','SUPER_ADMIN')")
    public Map<String, Object> manager() {
        return service.managerDashboard();
    }
}
