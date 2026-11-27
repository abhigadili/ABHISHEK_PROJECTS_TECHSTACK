package com.hrportal.payroll.controller;

import java.util.List;
import java.util.Set;

import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.hrportal.common.web.PageRequests;
import com.hrportal.common.web.PageResponse;
import com.hrportal.payroll.dto.PayrollDtos.AdjustmentRequest;
import com.hrportal.payroll.dto.PayrollDtos.AdjustmentResponse;
import com.hrportal.payroll.dto.PayrollDtos.ComponentTotal;
import com.hrportal.payroll.dto.PayrollDtos.DepartmentTotal;
import com.hrportal.payroll.dto.PayrollDtos.EntryResponse;
import com.hrportal.payroll.dto.PayrollDtos.LoanRequest;
import com.hrportal.payroll.dto.PayrollDtos.LoanResponse;
import com.hrportal.payroll.dto.PayrollDtos.MonthlyReport;
import com.hrportal.payroll.dto.PayrollDtos.PayslipResponse;
import com.hrportal.payroll.dto.PayrollDtos.RunRequest;
import com.hrportal.payroll.dto.PayrollDtos.RunResponse;
import com.hrportal.payroll.service.AdjustmentLoanService;
import com.hrportal.payroll.service.PayrollReportService;
import com.hrportal.payroll.service.PayrollRunService;
import com.hrportal.payroll.service.PayslipService;
import com.hrportal.payroll.service.PayslipService.Download;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@Tag(name = "Payroll Processing")
@RestController
@RequestMapping("/api/v1/payroll")
public class PayrollRunController {
    private static final Set<String> RUN_SORT = Set.of("payrollMonth", "status");
    private static final Set<String> ENTRY_SORT = Set.of("employeeName", "employeeCode", "gross", "net", "departmentId");
    private static final Set<String> ADJ_SORT = Set.of("createdAt", "payrollMonth", "amount");
    private final PayrollRunService runs;
    private final PayslipService payslips;
    private final AdjustmentLoanService adjustments;
    private final PayrollReportService reports;

    public PayrollRunController(PayrollRunService runs, PayslipService payslips, AdjustmentLoanService adjustments, PayrollReportService reports) {
        this.runs = runs;
        this.payslips = payslips;
        this.adjustments = adjustments;
        this.reports = reports;
    }

    // ---- runs
    @PostMapping("/runs")
    @PreAuthorize("hasAuthority('PERM_PAYROLL_PROCESS')")
    @ResponseStatus(HttpStatus.CREATED)
    public RunResponse create(@Valid @RequestBody RunRequest req) {
        return runs.create(req);
    }

    @GetMapping("/runs")
    @PreAuthorize("hasAuthority('PERM_PAYROLL_VIEW')")
    public PageResponse<RunResponse> list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "12") int size,
                                          @RequestParam(defaultValue = "payrollMonth,desc") String sort) {
        return PageResponse.of(runs.list(PageRequests.of(page, size, sort, RUN_SORT, "payrollMonth")));
    }

    @GetMapping("/runs/{id}")
    @PreAuthorize("hasAuthority('PERM_PAYROLL_VIEW')")
    public RunResponse get(@PathVariable String id) {
        return runs.get(id);
    }

    @Operation(summary = "Calculate payroll for the month (concurrent data gathering, engine, stored procedure)")
    @PostMapping("/runs/{id}/process")
    @PreAuthorize("hasAuthority('PERM_PAYROLL_PROCESS')")
    public RunResponse process(@PathVariable String id) {
        return runs.process(id);
    }

    @Operation(summary = "Approve a processed run (finance; not the person who processed it)")
    @PostMapping("/runs/{id}/approve")
    @PreAuthorize("hasAuthority('PERM_PAYROLL_APPROVE')")
    public RunResponse approve(@PathVariable String id) {
        return runs.approve(id);
    }

    @Operation(summary = "Finalize an approved run: publishes payroll.processed and generates the PDF payslips")
    @PostMapping("/runs/{id}/finalize")
    @PreAuthorize("hasAuthority('PERM_PAYROLL_PROCESS')")
    public RunResponse finalizeRun(@PathVariable String id) {
        return runs.finalizeRun(id);
    }

    @DeleteMapping("/runs/{id}")
    @PreAuthorize("hasAuthority('PERM_PAYROLL_PROCESS')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        runs.deleteDraft(id);
    }

    @GetMapping("/runs/{id}/entries")
    @PreAuthorize("hasAuthority('PERM_PAYROLL_VIEW')")
    public PageResponse<EntryResponse> entries(@PathVariable String id, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size,
                                               @RequestParam(defaultValue = "employeeName,asc") String sort) {
        return PageResponse.of(runs.entries(id, PageRequests.of(page, size, sort, ENTRY_SORT, "employeeName")));
    }

    @GetMapping("/entries/{entryId}")
    @PreAuthorize("hasAuthority('PERM_PAYROLL_VIEW')")
    public EntryResponse entry(@PathVariable String entryId) {
        return runs.entry(entryId);
    }

    @PostMapping("/runs/{id}/payslips/generate")
    @PreAuthorize("hasAuthority('PERM_PAYROLL_PROCESS')")
    public java.util.Map<String, Integer> regenerate(@PathVariable String id) {
        return java.util.Map.of("generated", payslips.generateForRun(id));
    }

    // ---- payslips
    @Operation(summary = "My payslips")
    @GetMapping("/payslips/me")
    public List<PayslipResponse> myPayslips() {
        return payslips.mine();
    }

    @GetMapping("/payslips/employee/{employeeId}")
    public List<PayslipResponse> payslipsOf(@PathVariable String employeeId) {
        return payslips.forEmployee(employeeId);
    }

    @Operation(summary = "Download a payslip PDF (own payslips, or PAYSLIP_VIEW_ALL)")
    @GetMapping("/payslips/{id}/download")
    public ResponseEntity<Resource> download(@PathVariable String id) {
        Download d = payslips.download(id);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF).contentLength(d.size())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(d.fileName()).build().toString()).body(d.resource());
    }

    // ---- adjustments / loans
    @PostMapping("/adjustments")
    @PreAuthorize("hasAuthority('PERM_PAYROLL_PROCESS')")
    @ResponseStatus(HttpStatus.CREATED)
    public AdjustmentResponse addAdjustment(@Valid @RequestBody AdjustmentRequest req) {
        return adjustments.addAdjustment(req);
    }

    @GetMapping("/adjustments")
    public PageResponse<AdjustmentResponse> adjustments(@RequestParam(required = false) String month, @RequestParam(required = false) String employeeId,
                                                        @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
                                                        @RequestParam(defaultValue = "createdAt,desc") String sort) {
        return PageResponse.of(adjustments.adjustments(month, employeeId, PageRequests.of(page, size, sort, ADJ_SORT, "createdAt")));
    }

    @DeleteMapping("/adjustments/{id}")
    @PreAuthorize("hasAuthority('PERM_PAYROLL_PROCESS')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancelAdjustment(@PathVariable String id) {
        adjustments.cancelAdjustment(id);
    }

    @PostMapping("/loans")
    @PreAuthorize("hasAuthority('PERM_PAYROLL_PROCESS')")
    @ResponseStatus(HttpStatus.CREATED)
    public LoanResponse addLoan(@Valid @RequestBody LoanRequest req) {
        return adjustments.addLoan(req);
    }

    @GetMapping("/loans/employee/{employeeId}")
    public List<LoanResponse> loans(@PathVariable String employeeId) {
        return adjustments.loansOf(employeeId);
    }

    @PatchMapping("/loans/{id}/close")
    @PreAuthorize("hasAuthority('PERM_PAYROLL_PROCESS')")
    public LoanResponse closeLoan(@PathVariable String id) {
        return adjustments.closeLoan(id);
    }

    // ---- reports
    @GetMapping("/reports/monthly")
    @PreAuthorize("hasAuthority('PERM_PAYROLL_VIEW')")
    public MonthlyReport monthly(@RequestParam String month) {
        return reports.monthly(month);
    }

    @Operation(summary = "Earnings and deductions grouped by salary component")
    @GetMapping("/reports/components")
    @PreAuthorize("hasAuthority('PERM_PAYROLL_VIEW')")
    public List<ComponentTotal> components(@RequestParam String month) {
        return reports.byComponent(month);
    }

    @GetMapping("/reports/departments")
    @PreAuthorize("hasAuthority('PERM_PAYROLL_VIEW')")
    public List<DepartmentTotal> departments(@RequestParam String month) {
        return reports.byDepartment(month);
    }
}
