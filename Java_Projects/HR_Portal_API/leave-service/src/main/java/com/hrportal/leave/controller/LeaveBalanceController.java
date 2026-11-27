package com.hrportal.leave.controller;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Set;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.security.CurrentUser;
import com.hrportal.common.web.PageRequests;
import com.hrportal.common.web.PageResponse;
import com.hrportal.leave.dto.LeaveDtos.AdjustmentRequest;
import com.hrportal.leave.dto.LeaveDtos.BalanceHistoryResponse;
import com.hrportal.leave.dto.LeaveDtos.BalanceResponse;
import com.hrportal.leave.dto.LeaveDtos.CalendarEntry;
import com.hrportal.leave.dto.LeaveDtos.EncashRequest;
import com.hrportal.leave.dto.LeaveDtos.EncashableResponse;
import com.hrportal.leave.dto.LeaveDtos.ReconciledBalance;
import com.hrportal.leave.dto.LeaveDtos.UnpaidDaysResponse;
import com.hrportal.leave.service.LeaveBalanceService;
import com.hrportal.leave.service.LeaveCalendarService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@Tag(name = "Leave Balances and Calendar")
@RestController
@RequestMapping("/api/v1/leaves")
public class LeaveBalanceController {
    private static final Set<String> SORT = Set.of("changedAt");
    private final LeaveBalanceService balances;
    private final LeaveCalendarService calendar;

    public LeaveBalanceController(LeaveBalanceService balances, LeaveCalendarService calendar) {
        this.balances = balances;
        this.calendar = calendar;
    }

    @Operation(summary = "My leave balances (Redis cached)")
    @GetMapping("/balances/me")
    public List<BalanceResponse> mine(@RequestParam(defaultValue = "#{T(java.time.Year).now().getValue()}") int year) {
        String me = CurrentUser.employeeId();
        if (me == null) throw new ForbiddenOperationException("Your account is not linked to an employee record");
        return balances.balances(me, year);
    }

    @GetMapping("/balances/{employeeId}")
    @PreAuthorize("@authz.isSelfOrFinanceStaff(#employeeId)")
    public List<BalanceResponse> of(@PathVariable String employeeId, @RequestParam(defaultValue = "#{T(java.time.Year).now().getValue()}") int year) {
        return balances.balances(employeeId, year);
    }

    @Operation(summary = "Balance transaction history (written by a MySQL trigger)")
    @GetMapping("/balances/{employeeId}/history")
    @PreAuthorize("@authz.isSelfOrFinanceStaff(#employeeId)")
    public PageResponse<BalanceHistoryResponse> history(@PathVariable String employeeId, @RequestParam(defaultValue = "#{T(java.time.Year).now().getValue()}") int year,
                                                        @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
                                                        @RequestParam(defaultValue = "changedAt,desc") String sort) {
        return PageResponse.of(balances.history(employeeId, year, PageRequests.of(page, size, sort, SORT, "changedAt")));
    }

    @Operation(summary = "Recalculate balances with the stored procedure sp_calculate_leave_balance and compare with the ledger")
    @GetMapping("/balances/{employeeId}/reconciliation")
    @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
    public List<ReconciledBalance> reconcile(@PathVariable String employeeId, @RequestParam(defaultValue = "#{T(java.time.Year).now().getValue()}") int year) {
        return balances.reconcile(employeeId, year);
    }

    @PostMapping("/balances/{employeeId}/adjust")
    @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
    public BalanceResponse adjust(@PathVariable String employeeId, @Valid @RequestBody AdjustmentRequest req) {
        return balances.adjust(employeeId, req);
    }

    @Operation(summary = "Days that may be encashed (policy configuration vs. available balance); used by the exit settlement")
    @GetMapping("/balances/{employeeId}/encashable")
    @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN','PAYROLL_ADMIN','FINANCE_ADMIN')")
    public EncashableResponse encashable(@PathVariable String employeeId, @RequestParam String leaveTypeId,
                                         @RequestParam(defaultValue = "#{T(java.time.Year).now().getValue()}") int year) {
        return balances.encashable(employeeId, leaveTypeId, year);
    }

    @PostMapping("/balances/{employeeId}/encash")
    @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN','PAYROLL_ADMIN')")
    public EncashableResponse encash(@PathVariable String employeeId, @Valid @RequestBody EncashRequest req) {
        return balances.encash(employeeId, req);
    }

    @Operation(summary = "My approved leave in a date range")
    @GetMapping("/calendar")
    public List<CalendarEntry> myCalendar(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                          @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return calendar.mine(from, to);
    }

    @Operation(summary = "Team leave calendar (manager: direct reports, HR: company / department)")
    @GetMapping("/calendar/team")
    @PreAuthorize("hasAnyRole('MANAGER','HR_ADMIN','SUPER_ADMIN')")
    public List<CalendarEntry> teamCalendar(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                            @RequestParam(required = false) String departmentId) {
        return calendar.team(from, to, departmentId);
    }

    @Operation(summary = "Upcoming approved leave of my team in the next N days")
    @GetMapping("/calendar/upcoming")
    @PreAuthorize("hasAnyRole('MANAGER','HR_ADMIN','SUPER_ADMIN')")
    public List<CalendarEntry> upcoming(@RequestParam(defaultValue = "30") int days) {
        return calendar.upcoming(days);
    }

    @Operation(summary = "Unpaid leave days of an employee in a month (consumed by Payroll)")
    @GetMapping("/unpaid-days")
    @PreAuthorize("hasAnyRole('PAYROLL_ADMIN','HR_ADMIN','FINANCE_ADMIN','SUPER_ADMIN')")
    public UnpaidDaysResponse unpaid(@RequestParam String employeeId, @RequestParam String month) {
        return calendar.unpaidDays(employeeId, YearMonth.parse(month));
    }
}
