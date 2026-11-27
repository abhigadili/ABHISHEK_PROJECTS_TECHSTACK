package com.hrportal.leave.service;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.exception.ServiceUnavailableException;
import com.hrportal.common.security.CurrentUser;
import com.hrportal.leave.client.EmployeeClient;
import com.hrportal.leave.client.EmployeeClient.TeamMemberInfo;
import com.hrportal.leave.dto.LeaveDtos.CalendarEntry;
import com.hrportal.leave.dto.LeaveDtos.LeaveTypeResponse;
import com.hrportal.leave.dto.LeaveDtos.UnpaidDaysResponse;
import com.hrportal.leave.entity.Enums.LeaveStatus;
import com.hrportal.leave.entity.LeaveApplication;
import com.hrportal.leave.repository.LeaveRepositories.LeaveApplicationRepository;
import com.hrportal.leave.repository.LeaveRepositories.LeaveEmployeeRepository;
import com.hrportal.leave.service.LeaveCatalogService.LeaveTypeService;

import feign.FeignException;

/** Personal / team / company leave calendars and the unpaid-leave figure payroll needs. */
@Service
@Transactional(readOnly = true)
public class LeaveCalendarService {
    private final LeaveApplicationRepository applications;
    private final LeaveEmployeeRepository employees;
    private final LeaveTypeService types;
    private final EmployeeClient employeeClient;
    private final JdbcTemplate jdbc;

    public LeaveCalendarService(LeaveApplicationRepository applications, LeaveEmployeeRepository employees, LeaveTypeService types,
                                EmployeeClient employeeClient, JdbcTemplate jdbc) {
        this.applications = applications;
        this.employees = employees;
        this.types = types;
        this.employeeClient = employeeClient;
        this.jdbc = jdbc;
    }

    public List<CalendarEntry> mine(LocalDate from, LocalDate to) {
        check(from, to);
        return entries(applications.findInRange(LeaveStatus.APPROVED, from, to, CurrentUser.employeeId()));
    }

    /** Manager: approved leave of the direct reports. HR: whole company, optionally one department. */
    public List<CalendarEntry> team(LocalDate from, LocalDate to, String departmentId) {
        check(from, to);
        if (CurrentUser.isHr()) {
            if (departmentId == null) return entries(applications.findInRange(LeaveStatus.APPROVED, from, to, null));
            Set<String> ids = employees.findByDepartmentId(departmentId).stream().map(e -> e.getEmployeeId()).collect(Collectors.toSet());
            return ids.isEmpty() ? List.of() : entries(applications.findInRangeForEmployees(LeaveStatus.APPROVED, from, to, ids));
        }
        String me = CurrentUser.employeeId();
        if (me == null) throw new ForbiddenOperationException("Your account is not linked to an employee record");
        try {
            Set<String> ids = employeeClient.team(me).stream().map(TeamMemberInfo::id).collect(Collectors.toSet());
            return ids.isEmpty() ? List.of() : entries(applications.findInRangeForEmployees(LeaveStatus.APPROVED, from, to, ids));
        } catch (FeignException e) {
            throw new ServiceUnavailableException("Employee service is unavailable");
        }
    }

    public List<CalendarEntry> upcoming(int days) {
        LocalDate today = LocalDate.now();
        return team(today, today.plusDays(Math.max(1, Math.min(days, 90))), null);
    }

    /** Days of UNPAID approved leave inside a month (weekends excluded by fn_working_days); consumed by the Payroll service. */
    public UnpaidDaysResponse unpaidDays(String employeeId, YearMonth month) {
        LocalDate start = month.atDay(1);
        LocalDate end = month.atEndOfMonth();
        BigDecimal days = jdbc.queryForObject("""
                SELECT COALESCE(SUM(fn_working_days(GREATEST(a.from_date, ?), LEAST(a.to_date, ?))), 0)
                FROM leave_applications a JOIN leave_types t ON t.id = a.leave_type_id
                WHERE a.employee_id = ? AND a.status = 'APPROVED' AND t.paid = 0 AND a.from_date <= ? AND a.to_date >= ?
                """, BigDecimal.class, Date.valueOf(start), Date.valueOf(end), employeeId, Date.valueOf(end), Date.valueOf(start));
        return new UnpaidDaysResponse(employeeId, month.toString(), days == null ? BigDecimal.ZERO : days);
    }

    private List<CalendarEntry> entries(List<LeaveApplication> list) {
        Map<String, LeaveTypeResponse> typeMap = types.byId();
        List<CalendarEntry> out = new ArrayList<>();
        for (LeaveApplication a : list) {
            LeaveTypeResponse t = typeMap.get(a.getLeaveTypeId());
            out.add(new CalendarEntry(a.getId(), a.getEmployeeId(), a.getEmployeeName(), t == null ? null : t.name(), a.getFromDate(), a.getToDate(), a.getDays(), a.getStatus().name()));
        }
        return out;
    }

    private static void check(LocalDate from, LocalDate to) {
        if (to.isBefore(from)) throw new BadRequestException("'to' must not be before 'from'");
        if (from.plusMonths(13).isBefore(to)) throw new BadRequestException("Range is limited to 13 months");
    }
}
