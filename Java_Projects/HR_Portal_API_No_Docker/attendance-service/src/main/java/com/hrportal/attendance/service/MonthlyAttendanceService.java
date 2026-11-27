package com.hrportal.attendance.service;

import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import com.hrportal.attendance.client.ExternalClients.EmployeeClient;
import com.hrportal.attendance.client.ExternalClients.HolidayClient;
import com.hrportal.attendance.client.ExternalClients.HolidayView;
import com.hrportal.attendance.dto.AttendanceDtos.MonthlySummaryResponse;
import com.hrportal.attendance.entity.AttendanceEmployee;
import com.hrportal.attendance.entity.HolidaySnapshot;
import com.hrportal.attendance.jdbc.AttendanceJdbc;
import com.hrportal.attendance.repository.AttendanceRepositories.AttendanceEmployeeRepository;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.exception.ServiceUnavailableException;
import com.hrportal.common.security.CurrentUser;

import feign.FeignException;

/**
 * Monthly attendance summary: first the holiday snapshot of the employee's location is refreshed (Feign call to the
 * Holiday service + JDBC batch upsert), then the stored procedure computes, stores and returns the month.
 */
@Service
public class MonthlyAttendanceService {
    private static final Logger log = LoggerFactory.getLogger(MonthlyAttendanceService.class);

    private final AttendanceJdbc jdbc;
    private final HolidayClient holidayClient;
    private final EmployeeClient employeeClient;
    private final AttendanceEmployeeRepository employees;
    private final AttendanceService attendance;
    private final Executor executor;

    public MonthlyAttendanceService(AttendanceJdbc jdbc, HolidayClient holidayClient, EmployeeClient employeeClient, AttendanceEmployeeRepository employees,
                                    AttendanceService attendance, @Qualifier("hrExecutor") Executor executor) {
        this.jdbc = jdbc;
        this.holidayClient = holidayClient;
        this.employeeClient = employeeClient;
        this.employees = employees;
        this.attendance = attendance;
        this.executor = executor;
    }

    public MonthlySummaryResponse summary(String employeeId, YearMonth month) {
        attendance.requireViewAccess(employeeId);
        if (month.isAfter(YearMonth.now().plusMonths(1))) throw new BadRequestException("Month is too far in the future");
        String location = locationOf(employeeId);
        syncHolidays(month, location);
        return jdbc.monthlySummary(employeeId, month.getYear(), month.getMonthValue(), location);
    }

    /** Team report: one summary per direct report, computed in parallel on the bounded hrExecutor pool (CompletableFuture.allOf). */
    public List<MonthlySummaryResponse> teamReport(YearMonth month) {
        List<AttendanceEmployee> team;
        if (CurrentUser.isHr()) {
            team = employees.findByStatusIn(List.of("ACTIVE", "ON_NOTICE"));
        } else {
            String me = CurrentUser.employeeId();
            if (me == null) throw new ForbiddenOperationException("Your account is not linked to an employee record");
            team = employees.findByManagerIdAndStatusIn(me, List.of("ACTIVE", "ON_NOTICE"));
        }
        List<CompletableFuture<MonthlySummaryResponse>> futures = new ArrayList<>();
        for (AttendanceEmployee e : team) {
            futures.add(CompletableFuture.supplyAsync(() -> {
                syncHolidays(month, e.getLocationId());
                return jdbc.monthlySummary(e.getEmployeeId(), month.getYear(), month.getMonthValue(), e.getLocationId());
            }, executor));
        }
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
        return futures.stream().map(CompletableFuture::join).toList();
    }

    private String locationOf(String employeeId) {
        return employees.findById(employeeId).map(AttendanceEmployee::getLocationId).orElseGet(() -> {
            try {
                return employeeClient.summary(employeeId).locationId();
            } catch (FeignException e) {
                throw new ServiceUnavailableException("Employee service is unavailable");
            }
        });
    }

    /** Feign: Attendance -> Holiday; JDBC batch upsert into holiday_snapshots. A Holiday-service outage degrades to the last known snapshot. */
    void syncHolidays(YearMonth month, String locationId) {
        try {
            List<HolidayView> list = holidayClient.range(month.atDay(1).toString(), month.atEndOfMonth().toString(), locationId);
            List<HolidaySnapshot> snaps = new ArrayList<>();
            for (HolidayView h : list) {
                if (!"MANDATORY".equals(h.type())) continue;
                HolidaySnapshot s = new HolidaySnapshot();
                s.setHolidayId(h.id());
                s.setHolidayDate(h.holidayDate());
                s.setName(h.name());
                String loc = h.scopes() == null ? null : h.scopes().stream().filter(x -> "LOCATION".equals(x.scopeType())).map(x -> x.scopeId()).findFirst().orElse(null);
                s.setLocationId(loc);
                snaps.add(s);
            }
            jdbc.upsertHolidays(snaps);
        } catch (RuntimeException e) {
            log.warn("Holiday sync skipped for {} ({}): using the last known snapshot", month, e.toString());
        }
    }
}
