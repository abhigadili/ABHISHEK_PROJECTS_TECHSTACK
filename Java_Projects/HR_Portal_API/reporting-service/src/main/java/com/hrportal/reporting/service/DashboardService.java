package com.hrportal.reporting.service;

import java.time.Duration;
import java.time.YearMonth;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;

import com.hrportal.common.client.HrWebClient;
import com.hrportal.common.client.WebClientFactory;
import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.security.CurrentUser;

import reactor.core.publisher.Mono;

/**
 * Employee and manager dashboards: every section comes from a different microservice through the non-blocking WebClient. All requests are STARTED
 * immediately (the Monos are subscribed with toFuture() so they run concurrently), the JWT and correlation id are captured once on the request thread
 * and bound to the client, each section has its own timeout and a failed section becomes {"error": ...} - one unavailable service never blanks the
 * dashboard. The only blocking call is the final join of the futures, on the servlet request thread.
 */
@Service
public class DashboardService {
    private static final Duration SECTION_TIMEOUT = Duration.ofSeconds(6);
    private static final ParameterizedTypeReference<List<Map<String, Object>>> LIST = new ParameterizedTypeReference<>() { };
    private static final ParameterizedTypeReference<Map<String, Object>> MAP = new ParameterizedTypeReference<>() { };

    private final HrWebClient employee, leave, holiday, attendance, timesheet, payroll, performance, project;

    public DashboardService(WebClientFactory f, @Value("${hr.services.employee.url}") String employeeUrl, @Value("${hr.services.leave.url}") String leaveUrl,
                            @Value("${hr.services.holiday.url}") String holidayUrl, @Value("${hr.services.attendance.url}") String attendanceUrl,
                            @Value("${hr.services.timesheet.url}") String timesheetUrl, @Value("${hr.services.payroll.url}") String payrollUrl,
                            @Value("${hr.services.performance.url}") String performanceUrl, @Value("${hr.services.project.url}") String projectUrl) {
        this.employee = f.create(employeeUrl);
        this.leave = f.create(leaveUrl);
        this.holiday = f.create(holidayUrl);
        this.attendance = f.create(attendanceUrl);
        this.timesheet = f.create(timesheetUrl);
        this.payroll = f.create(payrollUrl);
        this.performance = f.create(performanceUrl);
        this.project = f.create(projectUrl);
    }

    public Map<String, Object> employeeDashboard() {
        String me = requireEmployee();
        String token = CurrentUser.token();
        String cid = MDC.get("correlationId");
        String month = YearMonth.now().toString();
        Map<String, CompletableFuture<Object>> sections = new LinkedHashMap<>();
        sections.put("profile", section(employee.as(token, cid).get("/api/v1/employees/me", MAP)));
        sections.put("leaveBalance", section(leave.as(token, cid).get("/api/v1/leaves/balances/me", LIST)));
        sections.put("upcomingHolidays", section(holiday.as(token, cid).get("/api/v1/holidays/upcoming?limit=5", LIST)));
        sections.put("attendanceSummary", section(attendance.as(token, cid).get("/api/v1/attendance/monthly/me?month=" + month, MAP)));
        sections.put("recentTimesheets", section(timesheet.as(token, cid).get("/api/v1/timesheets/me?size=3", MAP)));
        sections.put("latestPayslip", section(payroll.as(token, cid).get("/api/v1/payroll/payslips/me", LIST).map(l -> l.isEmpty() ? Map.of("message", "no payslip yet") : l.get(0))));
        sections.put("pendingApprovals", section(leave.as(token, cid).get("/api/v1/leaves/applications/me?status=PENDING&size=5", MAP)));
        sections.put("performanceReviewStatus", section(performance.as(token, cid).get("/api/v1/performance/reviews/me", LIST)));
        sections.put("upcomingCompanyEvents", section(holiday.as(token, cid).get("/api/v1/holidays/upcoming?limit=3", LIST)));
        return join(me, sections);
    }

    public Map<String, Object> managerDashboard() {
        String me = requireEmployee();
        String token = CurrentUser.token();
        String cid = MDC.get("correlationId");
        String month = YearMonth.now().toString();
        Map<String, CompletableFuture<Object>> sections = new LinkedHashMap<>();
        sections.put("teamMembers", section(employee.as(token, cid).get("/api/v1/employees/" + me + "/team", LIST)));
        sections.put("pendingLeaveApprovals", section(leave.as(token, cid).get("/api/v1/leaves/approvals/pending", LIST)));
        sections.put("teamAttendanceSummary", section(attendance.as(token, cid).get("/api/v1/attendance/team/report?month=" + month, LIST)));
        sections.put("pendingTimesheetApprovals", section(timesheet.as(token, cid).get("/api/v1/timesheets/approvals/pending", LIST)));
        sections.put("upcomingEmployeeReviews", section(performance.as(token, cid).get("/api/v1/performance/reviews/pending", LIST)));
        // team project allocation: team list first (flatMap), then one allocation-summary call per member, all in parallel (Mono.zip)
        sections.put("teamProjectAllocation", section(employee.as(token, cid).get("/api/v1/employees/" + me + "/team", LIST).flatMap(team -> {
            List<Mono<Object>> calls = team.stream().limit(10).map(m -> project.as(token, cid).get("/api/v1/projects/employees/{id}/allocation-summary", MAP, m.get("id"))
                    .<Object>map(s -> s).onErrorReturn(Map.of("employeeId", String.valueOf(m.get("id")), "error", "unavailable"))).toList();
            return calls.isEmpty() ? Mono.just(List.of()) : Mono.zip(calls, arr -> List.of(arr));
        })));
        return join(me, sections);
    }

    /** Starts the request now (toFuture subscribes immediately) with a per-section timeout and an error fallback. */
    private <T> CompletableFuture<Object> section(Mono<T> mono) {
        return mono.timeout(SECTION_TIMEOUT).<Object>map(v -> v).toFuture().handle((v, ex) -> ex == null ? v : Map.of("error", "section unavailable: " + (ex.getCause() == null ? ex : ex.getCause()).getClass().getSimpleName()));
    }

    private Map<String, Object> join(String employeeId, Map<String, CompletableFuture<Object>> sections) {
        long start = System.nanoTime();
        CompletableFuture.allOf(sections.values().toArray(new CompletableFuture[0])).orTimeout(SECTION_TIMEOUT.toSeconds() + 2, TimeUnit.SECONDS).handle((v, ex) -> null).join();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("employeeId", employeeId);
        sections.forEach((name, f) -> out.put(name, f.isDone() ? f.join() : Map.of("error", "section timed out")));
        out.put("assembledInMs", TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start));
        return out;
    }

    private static String requireEmployee() {
        String me = CurrentUser.employeeId();
        if (me == null) throw new ForbiddenOperationException("Your account is not linked to an employee record");
        return me;
    }
}
