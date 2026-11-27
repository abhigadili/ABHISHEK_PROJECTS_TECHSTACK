package com.hrportal.reporting.controller;

import java.time.YearMonth;
import java.util.List;
import java.util.Map;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.hrportal.reporting.analytics.WorkforceAnalytics;
import com.hrportal.reporting.dto.ReportDtos.AttendanceReport;
import com.hrportal.reporting.dto.ReportDtos.ExecutiveSummary;
import com.hrportal.reporting.dto.ReportDtos.ExitReport;
import com.hrportal.reporting.dto.ReportDtos.HeadcountReport;
import com.hrportal.reporting.dto.ReportDtos.JoiningExitSummary;
import com.hrportal.reporting.dto.ReportDtos.LeaveReport;
import com.hrportal.reporting.dto.ReportDtos.PayrollReport;
import com.hrportal.reporting.dto.ReportDtos.PerformanceReport;
import com.hrportal.reporting.dto.ReportDtos.ProjectAllocationRow;
import com.hrportal.reporting.dto.ReportDtos.TaxReport;
import com.hrportal.reporting.dto.ReportDtos.TimesheetReport;
import com.hrportal.reporting.service.AsyncReportService;
import com.hrportal.reporting.service.ReportService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "Reports")
@RestController
@RequestMapping("/api/v1/reports")
public class ReportController {
    private final ReportService reports;
    private final AsyncReportService async;
    private final WorkforceAnalytics analytics;

    public ReportController(ReportService reports, AsyncReportService async, WorkforceAnalytics analytics) {
        this.reports = reports;
        this.async = async;
        this.analytics = analytics;
    }

    @Operation(summary = "Employee headcount grouped by department | location | designation | status")
    @GetMapping("/employees/headcount")
    @PreAuthorize("hasAuthority('PERM_REPORT_VIEW')")
    public HeadcountReport headcount(@RequestParam(defaultValue = "department") String groupBy) {
        return reports.headcount(groupBy);
    }

    @Operation(summary = "Employee joining and exit summary of a year, by month")
    @GetMapping("/employees/joining-exit")
    @PreAuthorize("hasAuthority('PERM_REPORT_VIEW')")
    public JoiningExitSummary joiningExit(@RequestParam(defaultValue = "#{T(java.time.Year).now().getValue()}") int year) {
        return reports.joiningExit(year);
    }

    @Operation(summary = "Department report: headcount per department (names resolved through the Organization service)")
    @GetMapping("/departments")
    @PreAuthorize("hasAuthority('PERM_REPORT_VIEW')")
    public HeadcountReport departments() {
        return reports.headcount("department");
    }

    @GetMapping("/leave")
    @PreAuthorize("hasAuthority('PERM_REPORT_VIEW')")
    public LeaveReport leave(@RequestParam(required = false) String period) {
        return reports.leave(period);
    }

    @GetMapping("/attendance")
    @PreAuthorize("hasAuthority('PERM_REPORT_VIEW')")
    public AttendanceReport attendance(@RequestParam(required = false) String month) {
        return reports.attendance(month == null ? YearMonth.now().toString() : month);
    }

    @Operation(summary = "Payroll report (payroll, finance and super admin only: it contains salary totals)")
    @GetMapping("/payroll")
    @PreAuthorize("hasAnyRole('PAYROLL_ADMIN','FINANCE_ADMIN','SUPER_ADMIN')")
    public PayrollReport payroll(@RequestParam String month) {
        return reports.payroll(month);
    }

    @GetMapping("/tax")
    @PreAuthorize("hasAnyRole('FINANCE_ADMIN','HR_ADMIN','SUPER_ADMIN')")
    public TaxReport tax(@RequestParam String financialYear) {
        return reports.tax(financialYear);
    }

    @GetMapping("/project-allocation")
    @PreAuthorize("hasAuthority('PERM_REPORT_VIEW')")
    public List<ProjectAllocationRow> allocation() {
        return reports.allocation();
    }

    @GetMapping("/timesheets")
    @PreAuthorize("hasAuthority('PERM_REPORT_VIEW')")
    public TimesheetReport timesheets(@RequestParam(required = false) String month) {
        return reports.timesheets(month == null ? YearMonth.now().toString() : month);
    }

    @GetMapping("/performance")
    @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
    public PerformanceReport performance(@RequestParam String cycleId) {
        return reports.performance(cycleId);
    }

    @GetMapping("/exits")
    @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
    public ExitReport exits() {
        return reports.exits();
    }

    @Operation(summary = "Executive summary: independent sections computed asynchronously (CompletableFuture) and merged")
    @GetMapping("/executive-summary")
    @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
    public ExecutiveSummary executive() {
        return async.executiveSummary();
    }

    @Operation(summary = "Workforce analytics computed with Java Streams / Collectors (see docs/202611251532-java-streams-guide.md)")
    @GetMapping("/analytics/workforce")
    @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
    public Map<String, Object> workforce() {
        return analytics.analyse();
    }
}
