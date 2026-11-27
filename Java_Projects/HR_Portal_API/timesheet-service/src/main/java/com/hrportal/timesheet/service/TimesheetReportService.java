package com.hrportal.timesheet.service;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Types;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.SqlParameter;
import org.springframework.jdbc.core.simple.SimpleJdbcCall;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.security.CurrentUser;
import com.hrportal.common.security.Role;
import com.hrportal.timesheet.dto.TimesheetDtos.EmployeeHours;
import com.hrportal.timesheet.dto.TimesheetDtos.EmployeeHoursSummary;
import com.hrportal.timesheet.dto.TimesheetDtos.ProjectHours;
import com.hrportal.timesheet.dto.TimesheetDtos.ProjectHoursSummary;
import com.hrportal.timesheet.repository.TimesheetRepositories.EntryRepository;

/** Work-hour summaries: per employee (stored procedure sp_timesheet_summary) and per project (JPQL aggregate). Only APPROVED hours count. */
@Service
public class TimesheetReportService {
    private final SimpleJdbcCall summaryCall;
    private final EntryRepository entries;

    public TimesheetReportService(JdbcTemplate jdbc, EntryRepository entries) {
        this.entries = entries;
        this.summaryCall = new SimpleJdbcCall(jdbc).withProcedureName("sp_timesheet_summary").withoutProcedureColumnMetaDataAccess()
                .declareParameters(new SqlParameter("p_employee_id", Types.VARCHAR), new SqlParameter("p_from", Types.DATE), new SqlParameter("p_to", Types.DATE))
                .returningResultSet("rows", (rs, i) -> {
                    BigDecimal total = rs.getBigDecimal("total_hours");
                    BigDecimal billable = rs.getBigDecimal("billable_hours");
                    return new ProjectHours(rs.getString("project_id"), total, billable, total.subtract(billable));
                });
    }

    @Transactional(readOnly = true)
    @SuppressWarnings("unchecked")
    public EmployeeHoursSummary employee(String employeeId, LocalDate from, LocalDate to) {
        check(from, to);
        if (!CurrentUser.hasAnyRole(Role.HR_ADMIN, Role.SUPER_ADMIN, Role.FINANCE_ADMIN, Role.PAYROLL_ADMIN, Role.MANAGER, Role.PROJECT_MANAGER) && !employeeId.equals(CurrentUser.employeeId())) {
            throw new ForbiddenOperationException("You can only view your own work-hour summary");
        }
        Map<String, Object> result = summaryCall.execute(Map.of("p_employee_id", employeeId, "p_from", Date.valueOf(from), "p_to", Date.valueOf(to)));
        List<ProjectHours> rows = (List<ProjectHours>) result.getOrDefault("rows", List.of());
        BigDecimal total = rows.stream().map(ProjectHours::totalHours).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal billable = rows.stream().map(ProjectHours::billableHours).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal pct = total.signum() == 0 ? BigDecimal.ZERO : billable.multiply(BigDecimal.valueOf(100)).divide(total, 1, java.math.RoundingMode.HALF_UP);
        return new EmployeeHoursSummary(employeeId, from, to, total, billable, total.subtract(billable), pct, rows);
    }

    @Transactional(readOnly = true)
    public ProjectHoursSummary project(String projectId, LocalDate from, LocalDate to) {
        check(from, to);
        List<EmployeeHours> rows = entries.approvedHoursByEmployee(projectId, from, to).stream().map(r -> new EmployeeHours(r.getEmployeeId(), r.getHours(), r.getBillableHours())).toList();
        BigDecimal total = rows.stream().map(EmployeeHours::totalHours).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal billable = rows.stream().map(EmployeeHours::billableHours).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new ProjectHoursSummary(projectId, from, to, total, billable, rows);
    }

    private static void check(LocalDate from, LocalDate to) {
        if (to.isBefore(from)) throw new BadRequestException("'to' must not be before 'from'");
        if (from.plusYears(2).isBefore(to)) throw new BadRequestException("Range is limited to 2 years");
    }
}
