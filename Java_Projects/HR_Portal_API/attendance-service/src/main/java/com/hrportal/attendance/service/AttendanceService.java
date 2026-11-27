package com.hrportal.attendance.service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.attendance.dto.AttendanceDtos.AttendanceResponse;
import com.hrportal.attendance.dto.AttendanceDtos.CalendarDay;
import com.hrportal.attendance.dto.AttendanceDtos.DailyReportRow;
import com.hrportal.attendance.entity.ApprovedLeaveDay;
import com.hrportal.attendance.entity.AttendanceEmployee;
import com.hrportal.attendance.entity.AttendanceRecord;
import com.hrportal.attendance.entity.Enums.AttendanceStatus;
import com.hrportal.attendance.entity.Enums.Source;
import com.hrportal.attendance.entity.Enums.WorkMode;
import com.hrportal.attendance.entity.HolidaySnapshot;
import com.hrportal.attendance.entity.Shift;
import com.hrportal.attendance.producer.AttendanceEventProducer;
import com.hrportal.attendance.repository.AttendanceRepositories.ApprovedLeaveDayRepository;
import com.hrportal.attendance.repository.AttendanceRepositories.AttendanceEmployeeRepository;
import com.hrportal.attendance.repository.AttendanceRepositories.AttendanceRecordRepository;
import com.hrportal.attendance.repository.AttendanceRepositories.HolidaySnapshotRepository;
import com.hrportal.attendance.repository.AttendanceRepositories.WfhRepository;
import com.hrportal.common.audit.AuditService;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ConflictException;
import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.common.persistence.BeanMapper;
import com.hrportal.common.security.CurrentUser;

/**
 * Check-in / check-out and the per-day calculations: late arrival, early departure, worked minutes, overtime
 * (MySQL function fn_overtime_minutes) and the day status (PRESENT / HALF_DAY / ABSENT / MISSING_PUNCH) from the shift thresholds.
 */
@Service
public class AttendanceService {
    private static final Logger log = LoggerFactory.getLogger(AttendanceService.class);

    private final AttendanceRecordRepository records;
    private final AttendanceEmployeeRepository employees;
    private final ShiftService shifts;
    private final WfhRepository wfh;
    private final ApprovedLeaveDayRepository leaveDays;
    private final HolidaySnapshotRepository holidays;
    private final AttendanceEventProducer producer;
    private final AuditService audit;
    private final JdbcTemplate jdbc;
    private final ZoneId zone;

    public AttendanceService(AttendanceRecordRepository records, AttendanceEmployeeRepository employees, ShiftService shifts, WfhRepository wfh,
                             ApprovedLeaveDayRepository leaveDays, HolidaySnapshotRepository holidays, AttendanceEventProducer producer,
                             AuditService audit, JdbcTemplate jdbc, @Value("${hr.attendance.zone:Asia/Kolkata}") String zone) {
        this.records = records;
        this.employees = employees;
        this.shifts = shifts;
        this.wfh = wfh;
        this.leaveDays = leaveDays;
        this.holidays = holidays;
        this.producer = producer;
        this.audit = audit;
        this.jdbc = jdbc;
        this.zone = ZoneId.of(zone);
    }

    public LocalDate today() {
        return LocalDate.now(zone);
    }

    // ------------------------------------------------------------------ punches
    @Transactional
    public AttendanceResponse checkIn(String employeeId, String requestedMode, Instant at, Source source) {
        LocalDate date = at.atZone(zone).toLocalDate();
        if (records.findByEmployeeIdAndWorkDate(employeeId, date).filter(r -> r.getCheckIn() != null).isPresent()) {
            throw new ConflictException("Already checked in for " + date);
        }
        WorkMode mode = "WFH".equals(requestedMode) ? WorkMode.WFH : WorkMode.OFFICE;
        if (mode == WorkMode.WFH && !wfh.isApprovedOn(employeeId, date)) throw new BadRequestException("No approved work-from-home request covers " + date);
        Shift shift = shifts.shiftFor(employeeId, date);
        AttendanceRecord r = records.findByEmployeeIdAndWorkDate(employeeId, date).orElseGet(AttendanceRecord::new);
        r.setEmployeeId(employeeId);
        r.setWorkDate(date);
        r.setCheckIn(at);
        r.setWorkMode(mode);
        r.setShiftId(shift.getId());
        r.setSource(source);
        r.setLateMinutes(lateMinutes(at, shift));
        r.setStatus(AttendanceStatus.MISSING_PUNCH);      // until the check-out closes the day
        r = records.save(r);
        producer.checkedIn(r);
        audit.record("AttendanceRecord", r.getId(), "CHECK_IN", at.toString());
        log.info("Employee {} checked in at {} (late {} min, {})", employeeId, at, r.getLateMinutes(), mode);
        return toResponse(r);
    }

    @Transactional
    public AttendanceResponse checkOut(String employeeId, Instant at, Source source) {
        LocalDate date = at.atZone(zone).toLocalDate();
        AttendanceRecord r = records.findByEmployeeIdAndWorkDate(employeeId, date).filter(x -> x.getCheckIn() != null)
                .orElseGet(() -> records.findByEmployeeIdAndWorkDate(employeeId, date.minusDays(1)).filter(x -> x.getCheckIn() != null && x.getCheckOut() == null)
                        .orElseThrow(() -> new BadRequestException("No check-in found - check in first (or request a correction)")));
        if (r.getCheckOut() != null && source == Source.WEB) throw new ConflictException("Already checked out for " + r.getWorkDate());
        if (!at.isAfter(r.getCheckIn())) throw new BadRequestException("Check-out must be after check-in");
        r.setCheckOut(at);
        recalculate(r, shifts.shiftFor(employeeId, r.getWorkDate()));
        r = records.save(r);
        producer.checkedOut(r);
        audit.record("AttendanceRecord", r.getId(), "CHECK_OUT", at + " worked=" + r.getWorkedMinutes() + "m ot=" + r.getOvertimeMinutes() + "m");
        return toResponse(r);
    }

    /** Recomputes worked / early / overtime / status from the punches and the shift rules. */
    public void recalculate(AttendanceRecord r, Shift shift) {
        if (r.getCheckIn() == null || r.getCheckOut() == null) {
            r.setStatus(AttendanceStatus.MISSING_PUNCH);
            return;
        }
        int worked = (int) Duration.between(r.getCheckIn(), r.getCheckOut()).toMinutes();
        r.setWorkedMinutes(worked);
        r.setLateMinutes(lateMinutes(r.getCheckIn(), shift));
        LocalTime out = r.getCheckOut().atZone(zone).toLocalTime();
        r.setEarlyDepartureMinutes(worked >= shift.getFullDayMinutes() || !out.isBefore(shift.getEndTime()) ? 0 : (int) Duration.between(out, shift.getEndTime()).toMinutes());
        r.setOvertimeMinutes(overtime(worked, shift.getStandardMinutes(), shift.getOvertimeThresholdMinutes()));
        r.setStatus(worked >= shift.getFullDayMinutes() ? AttendanceStatus.PRESENT : worked >= shift.getHalfDayMinutes() ? AttendanceStatus.HALF_DAY : AttendanceStatus.ABSENT);
        r.setShiftId(shift.getId());
    }

    /** MySQL function fn_overtime_minutes(worked, standard, threshold) via JdbcTemplate. */
    private int overtime(int worked, int standard, int threshold) {
        Integer v = jdbc.queryForObject("SELECT fn_overtime_minutes(?, ?, ?)", Integer.class, worked, standard, threshold);
        return v == null ? 0 : v;
    }

    private int lateMinutes(Instant checkIn, Shift shift) {
        LocalTime in = checkIn.atZone(zone).toLocalTime();
        LocalTime limit = shift.getStartTime().plusMinutes(shift.getGraceMinutes());
        return in.isAfter(limit) ? (int) Duration.between(shift.getStartTime(), in).toMinutes() : 0;
    }

    /** Used by the nightly job: yesterday's open punches become MISSING_PUNCH (employee then requests a correction). */
    @Transactional
    public int flagMissingPunches() {
        int n = 0;
        for (AttendanceRecord r : records.findOpenBefore(today())) {
            r.setStatus(AttendanceStatus.MISSING_PUNCH);
            r.setRemarks("No check-out recorded");
            records.save(r);
            producer.notify(r.getEmployeeId(), "MISSING_PUNCH", r.getId(), Map.of("date", r.getWorkDate().toString()), "missing-punch:" + r.getId());
            n++;
        }
        return n;
    }

    // ------------------------------------------------------------------ queries
    @Transactional(readOnly = true)
    public List<AttendanceResponse> range(String employeeId, LocalDate from, LocalDate to) {
        checkRange(from, to);
        requireViewAccess(employeeId);
        return BeanMapper.toRecords(records.findByEmployeeIdAndWorkDateBetweenOrderByWorkDate(employeeId, from, to), AttendanceResponse.class);
    }

    @Transactional(readOnly = true)
    public AttendanceResponse today(String employeeId) {
        return records.findByEmployeeIdAndWorkDate(employeeId, today()).map(this::toResponse)
                .orElseThrow(() -> ResourceNotFoundException.of("Attendance for today of", employeeId));
    }

    /** Daily report: HR sees every employee that has a record, a manager the direct reports (with ABSENT rows for the missing ones). */
    @Transactional(readOnly = true)
    public List<DailyReportRow> daily(LocalDate date) {
        List<AttendanceEmployee> scope;
        if (CurrentUser.isHr()) {
            scope = employees.findByStatusIn(List.of("ACTIVE", "ON_NOTICE"));
        } else {
            String me = CurrentUser.employeeId();
            if (me == null) throw new ForbiddenOperationException("Your account is not linked to an employee record");
            scope = employees.findByManagerIdAndStatusIn(me, List.of("ACTIVE", "ON_NOTICE"));
        }
        Map<String, AttendanceRecord> byEmployee = records.findByWorkDateAndEmployeeIdIn(date, scope.stream().map(AttendanceEmployee::getEmployeeId).toList())
                .stream().collect(Collectors.toMap(AttendanceRecord::getEmployeeId, r -> r));
        List<DailyReportRow> rows = new ArrayList<>();
        for (AttendanceEmployee e : scope) {
            AttendanceRecord r = byEmployee.get(e.getEmployeeId());
            rows.add(r == null ? new DailyReportRow(e.getEmployeeId(), e.getFullName(), "NO_RECORD", null, null, 0, 0, null)
                    : new DailyReportRow(e.getEmployeeId(), e.getFullName(), r.getStatus().name(), r.getCheckIn(), r.getCheckOut(), r.getWorkedMinutes(), r.getLateMinutes(), r.getWorkMode().name()));
        }
        rows.sort(java.util.Comparator.comparing(DailyReportRow::employeeName, java.util.Comparator.nullsLast(String::compareToIgnoreCase)));
        return rows;
    }

    /** Month calendar of one employee: for each date the record, or why there is none (holiday / weekly off / leave / future). */
    @Transactional(readOnly = true)
    public List<CalendarDay> calendar(String employeeId, int year, int month) {
        requireViewAccess(employeeId);
        LocalDate start = LocalDate.of(year, month, 1);
        LocalDate end = start.plusMonths(1).minusDays(1);
        Shift shift = shifts.shiftFor(employeeId, end);
        String location = employees.findById(employeeId).map(AttendanceEmployee::getLocationId).orElse(null);
        Map<LocalDate, AttendanceRecord> rec = records.findByEmployeeIdAndWorkDateBetweenOrderByWorkDate(employeeId, start, end).stream()
                .collect(Collectors.toMap(AttendanceRecord::getWorkDate, r -> r));
        Map<LocalDate, HolidaySnapshot> hol = holidays.findForLocation(start, end, location).stream().collect(Collectors.toMap(HolidaySnapshot::getHolidayDate, h -> h, (a, b) -> a));
        Map<LocalDate, ApprovedLeaveDay> leave = leaveDays.findByEmployeeIdAndLeaveDateBetween(employeeId, start, end).stream()
                .collect(Collectors.toMap(ApprovedLeaveDay::getLeaveDate, l -> l, (a, b) -> a));
        List<CalendarDay> out = new ArrayList<>();
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            AttendanceRecord r = rec.get(d);
            String dow = d.getDayOfWeek().name().substring(0, 3);
            if (r != null) out.add(new CalendarDay(d, "WORKED", r.getStatus().name(), r.getCheckIn(), r.getCheckOut(), r.getWorkedMinutes(), r.getWorkMode().name()));
            else if (hol.containsKey(d)) out.add(new CalendarDay(d, "HOLIDAY", null, null, null, 0, hol.get(d).getName()));
            else if (java.util.Arrays.asList(shift.getWeeklyOffs().split(",")).contains(dow)) out.add(new CalendarDay(d, "WEEKLY_OFF", null, null, null, 0, null));
            else if (leave.containsKey(d)) out.add(new CalendarDay(d, "ON_LEAVE", null, null, null, 0, null));
            else out.add(new CalendarDay(d, d.isAfter(today()) ? "UPCOMING" : "NO_RECORD", null, null, null, 0, null));
        }
        return out;
    }

    // ------------------------------------------------------------------ helpers
    public void requireViewAccess(String employeeId) {
        if (CurrentUser.isHr() || CurrentUser.hasAnyRole(com.hrportal.common.security.Role.PAYROLL_ADMIN, com.hrportal.common.security.Role.FINANCE_ADMIN)) return;
        String me = CurrentUser.employeeId();
        if (me != null && me.equals(employeeId)) return;
        boolean isManager = me != null && employees.findById(employeeId).map(e -> me.equals(e.getManagerId())).orElse(false);
        if (!isManager) throw new ForbiddenOperationException("You can only view your own or your team's attendance");
    }

    private static void checkRange(LocalDate from, LocalDate to) {
        if (to.isBefore(from)) throw new BadRequestException("'to' must not be before 'from'");
        if (from.plusDays(400).isBefore(to)) throw new BadRequestException("Range is limited to 400 days");
    }

    AttendanceResponse toResponse(AttendanceRecord r) {
        return BeanMapper.toRecord(r, AttendanceResponse.class);
    }
}
