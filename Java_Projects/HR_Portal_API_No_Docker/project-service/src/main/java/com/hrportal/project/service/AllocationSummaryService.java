package com.hrportal.project.service;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Types;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.SqlParameter;
import org.springframework.jdbc.core.simple.SimpleJdbcCall;
import org.springframework.stereotype.Service;

import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.security.CurrentUser;
import com.hrportal.common.security.Role;
import com.hrportal.project.dto.ProjectDtos.AllocationSummary;
import com.hrportal.project.dto.ProjectDtos.AllocationSummaryRow;

/** Employee project-allocation summary through the stored procedure sp_employee_allocation_summary (SimpleJdbcCall). */
@Service
public class AllocationSummaryService {
    private final SimpleJdbcCall call;

    public AllocationSummaryService(JdbcTemplate jdbc) {
        this.call = new SimpleJdbcCall(jdbc).withProcedureName("sp_employee_allocation_summary").withoutProcedureColumnMetaDataAccess()
                .declareParameters(new SqlParameter("p_employee_id", Types.VARCHAR), new SqlParameter("p_on_date", Types.DATE))
                .returningResultSet("rows", (rs, i) -> new AllocationSummaryRow(rs.getString("project_id"), rs.getString("project_code"), rs.getString("project_name"),
                        rs.getString("role"), rs.getBigDecimal("allocation_percent"), rs.getBoolean("billable")));
    }

    @SuppressWarnings("unchecked")
    public AllocationSummary summary(String employeeId, LocalDate date) {
        if (!CurrentUser.hasAnyRole(Role.SUPER_ADMIN, Role.HR_ADMIN, Role.PROJECT_MANAGER, Role.MANAGER) && !employeeId.equals(CurrentUser.employeeId())) {
            throw new ForbiddenOperationException("You can only view your own allocation");
        }
        Map<String, Object> result = call.execute(Map.of("p_employee_id", employeeId, "p_on_date", Date.valueOf(date)));
        List<AllocationSummaryRow> rows = new ArrayList<>((List<AllocationSummaryRow>) result.getOrDefault("rows", List.of()));
        BigDecimal total = rows.stream().map(AllocationSummaryRow::allocationPercent).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new AllocationSummary(employeeId, date, total, BigDecimal.valueOf(100).subtract(total).max(BigDecimal.ZERO), rows);
    }
}
