package com.hrportal.timesheet.controller;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

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

import com.hrportal.common.web.PageRequests;
import com.hrportal.common.web.PageResponse;
import com.hrportal.timesheet.dto.TimesheetDtos.DecisionRequest;
import com.hrportal.timesheet.dto.TimesheetDtos.EntryRequest;
import com.hrportal.timesheet.dto.TimesheetDtos.HistoryResponse;
import com.hrportal.timesheet.dto.TimesheetDtos.ReopenRequest;
import com.hrportal.timesheet.dto.TimesheetDtos.SaveEntriesRequest;
import com.hrportal.timesheet.dto.TimesheetDtos.TimesheetResponse;
import com.hrportal.timesheet.dto.TimesheetDtos.WeeklyTotals;
import com.hrportal.timesheet.service.TimesheetService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@Tag(name = "Timesheets")
@RestController
@RequestMapping("/api/v1/timesheets")
public class TimesheetController {
    private static final Set<String> SORT = Set.of("weekStart", "status", "totalHours", "submittedAt");
    private final TimesheetService service;

    public TimesheetController(TimesheetService service) {
        this.service = service;
    }

    @Operation(summary = "Weekly entry: replaces the lines of a week (validates allocation, daily totals, duplicates)")
    @PutMapping("/me/entries")
    public TimesheetResponse saveWeek(@Valid @RequestBody SaveEntriesRequest req) {
        return service.saveEntries(req);
    }

    @Operation(summary = "Daily entry: books / replaces one line (project, optional task, day)")
    @PostMapping("/me/entries")
    @ResponseStatus(HttpStatus.CREATED)
    public TimesheetResponse saveDay(@Valid @RequestBody EntryRequest req) {
        return service.saveDay(req);
    }

    @GetMapping("/me")
    public PageResponse<TimesheetResponse> mine(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                                @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                                @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
                                                @RequestParam(defaultValue = "weekStart,desc") String sort) {
        LocalDate f = from == null ? LocalDate.now().minusMonths(3) : from;
        LocalDate t = to == null ? LocalDate.now() : to;
        return PageResponse.of(service.mine(f, t, PageRequests.of(page, size, sort, SORT, "weekStart")));
    }

    @GetMapping("/me/week/{weekStart}")
    public TimesheetResponse week(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart) {
        return service.week(weekStart);
    }

    @GetMapping("/me/week/{weekStart}/totals")
    public WeeklyTotals totals(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart) {
        return service.totals(weekStart);
    }

    @Operation(summary = "Submit a week for approval (first submission or resubmission after a rejection)")
    @PostMapping("/me/week/{weekStart}/submit")
    public TimesheetResponse submit(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart) {
        return service.submit(weekStart);
    }

    @GetMapping("/employee/{employeeId}")
    public PageResponse<TimesheetResponse> forEmployee(@PathVariable String employeeId, @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                                       @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                                       @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
                                                       @RequestParam(defaultValue = "weekStart,desc") String sort) {
        LocalDate f = from == null ? LocalDate.now().minusMonths(3) : from;
        LocalDate t = to == null ? LocalDate.now() : to;
        return PageResponse.of(service.forEmployee(employeeId, f, t, PageRequests.of(page, size, sort, SORT, "weekStart")));
    }

    @GetMapping("/approvals/pending")
    @PreAuthorize("hasAuthority('PERM_TIMESHEET_APPROVE')")
    public List<TimesheetResponse> pending() {
        return service.pending();
    }

    @GetMapping("/{id}")
    public TimesheetResponse get(@PathVariable String id) {
        return service.get(id);
    }

    @GetMapping("/{id}/history")
    public List<HistoryResponse> history(@PathVariable String id) {
        return service.history(id);
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAuthority('PERM_TIMESHEET_APPROVE')")
    public TimesheetResponse approve(@PathVariable String id, @Valid @RequestBody(required = false) DecisionRequest req) {
        return service.approve(id, req == null ? null : req.comment());
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAuthority('PERM_TIMESHEET_APPROVE')")
    public TimesheetResponse reject(@PathVariable String id, @Valid @RequestBody DecisionRequest req) {
        return service.reject(id, req.comment());
    }

    @Operation(summary = "Timesheet correction: reopen an approved sheet")
    @PostMapping("/{id}/reopen")
    @PreAuthorize("hasAuthority('PERM_TIMESHEET_APPROVE')")
    public TimesheetResponse reopen(@PathVariable String id, @Valid @RequestBody ReopenRequest req) {
        return service.reopen(id, req.reason());
    }
}
