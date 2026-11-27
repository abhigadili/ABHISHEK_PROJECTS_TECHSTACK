package com.hrportal.attendance.controller;

import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.hrportal.attendance.dto.AttendanceDtos.AttendanceResponse;
import com.hrportal.attendance.dto.AttendanceDtos.CalendarDay;
import com.hrportal.attendance.dto.AttendanceDtos.CheckInRequest;
import com.hrportal.attendance.dto.AttendanceDtos.DailyReportRow;
import com.hrportal.attendance.dto.AttendanceDtos.MonthlySummaryResponse;
import com.hrportal.attendance.dto.AttendanceDtos.PunchImportRequest;
import com.hrportal.attendance.dto.AttendanceDtos.PunchImportResponse;
import com.hrportal.attendance.entity.Enums.Source;
import com.hrportal.attendance.queue.PunchImportQueue;
import com.hrportal.attendance.queue.PunchImportQueue.Punch;
import com.hrportal.attendance.service.AttendanceService;
import com.hrportal.attendance.service.MonthlyAttendanceService;
import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.security.CurrentUser;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@Tag(name = "Attendance")
@RestController
@RequestMapping("/api/v1/attendance")
public class AttendanceController {
    private final AttendanceService service;
    private final MonthlyAttendanceService monthly;
    private final PunchImportQueue importQueue;

    public AttendanceController(AttendanceService service, MonthlyAttendanceService monthly, PunchImportQueue importQueue) {
        this.service = service;
        this.monthly = monthly;
        this.importQueue = importQueue;
    }

    private static String me() {
        String id = CurrentUser.employeeId();
        if (id == null) throw new ForbiddenOperationException("Your account is not linked to an employee record");
        return id;
    }

    @Operation(summary = "Check in now (office, or WFH when an approved request exists)")
    @PostMapping("/check-in")
    @ResponseStatus(HttpStatus.CREATED)
    public AttendanceResponse checkIn(@Valid @RequestBody(required = false) CheckInRequest req) {
        return service.checkIn(me(), req == null ? null : req.workMode(), Instant.now(), Source.WEB);
    }

    @Operation(summary = "Check out now: computes worked time, early departure and overtime")
    @PostMapping("/check-out")
    public AttendanceResponse checkOut() {
        return service.checkOut(me(), Instant.now(), Source.WEB);
    }

    @GetMapping("/me/today")
    public AttendanceResponse today() {
        return service.today(me());
    }

    @Operation(summary = "My attendance records (defaults to the current month)")
    @GetMapping("/me")
    public List<AttendanceResponse> mine(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        YearMonth now = YearMonth.now();
        return service.range(me(), from == null ? now.atDay(1) : from, to == null ? now.atEndOfMonth() : to);
    }

    @GetMapping("/employees/{employeeId}")
    public List<AttendanceResponse> of(@PathVariable String employeeId, @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                       @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.range(employeeId, from, to);
    }

    @Operation(summary = "Daily attendance of the team (manager) or everybody (HR)")
    @GetMapping("/daily")
    @PreAuthorize("hasAnyRole('MANAGER','HR_ADMIN','SUPER_ADMIN')")
    public List<DailyReportRow> daily(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.daily(date == null ? service.today() : date);
    }

    @Operation(summary = "My attendance calendar of a month (record, holiday, weekly off, leave)")
    @GetMapping("/calendar")
    public List<CalendarDay> myCalendar(@RequestParam(required = false) String month) {
        YearMonth m = month == null ? YearMonth.now() : YearMonth.parse(month);
        return service.calendar(me(), m.getYear(), m.getMonthValue());
    }

    @GetMapping("/calendar/{employeeId}")
    public List<CalendarDay> calendarOf(@PathVariable String employeeId, @RequestParam(required = false) String month) {
        YearMonth m = month == null ? YearMonth.now() : YearMonth.parse(month);
        return service.calendar(employeeId, m.getYear(), m.getMonthValue());
    }

    @Operation(summary = "Monthly attendance summary (stored procedure sp_monthly_attendance_summary); used by Payroll")
    @GetMapping("/monthly/{employeeId}")
    public MonthlySummaryResponse monthlySummary(@PathVariable String employeeId, @RequestParam(required = false) String month) {
        return monthly.summary(employeeId, month == null ? YearMonth.now() : YearMonth.parse(month));
    }

    @GetMapping("/monthly/me")
    public MonthlySummaryResponse myMonthly(@RequestParam(required = false) String month) {
        return monthly.summary(me(), month == null ? YearMonth.now() : YearMonth.parse(month));
    }

    @Operation(summary = "Team attendance report for a month (summaries computed in parallel)")
    @GetMapping("/team/report")
    @PreAuthorize("hasAnyRole('MANAGER','HR_ADMIN','SUPER_ADMIN')")
    public List<MonthlySummaryResponse> teamReport(@RequestParam(required = false) String month) {
        return monthly.teamReport(month == null ? YearMonth.now() : YearMonth.parse(month));
    }

    @Operation(summary = "Bulk punch import (device export): queued and processed by a background consumer")
    @PostMapping("/punches/import")
    @PreAuthorize("hasAuthority('PERM_ATTENDANCE_MANAGE')")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public PunchImportResponse importPunches(@Valid @RequestBody PunchImportRequest req) {
        int queued = importQueue.offerAll(req.punches().stream().map(p -> new Punch(p.employeeId(), p.timestamp())).toList());
        return new PunchImportResponse(queued, importQueue.depth());
    }

    @Operation(summary = "Run the missing-punch detection now (also runs nightly)")
    @PostMapping("/jobs/missing-punch")
    @PreAuthorize("hasAuthority('PERM_ATTENDANCE_MANAGE')")
    public java.util.Map<String, Integer> runMissingPunchJob() {
        return java.util.Map.of("flagged", service.flagMissingPunches());
    }
}
