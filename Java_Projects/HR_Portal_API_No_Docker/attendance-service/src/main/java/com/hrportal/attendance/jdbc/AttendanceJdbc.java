package com.hrportal.attendance.jdbc;

import java.sql.CallableStatement;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;
import java.util.List;

import javax.sql.DataSource;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Repository;

import com.hrportal.attendance.dto.AttendanceDtos.MonthlySummaryResponse;
import com.hrportal.attendance.entity.HolidaySnapshot;
import com.hrportal.common.exception.ServiceUnavailableException;

/**
 * Plain JDBC on purpose (the other services use JdbcTemplate): Connection, PreparedStatement with bound parameters,
 * batch updates inside an explicit transaction (commit / rollback), CallableStatement for the stored procedure and
 * ResultSet mapping. Every statement is parameterised - no value is ever concatenated into SQL.
 */
@Repository
public class AttendanceJdbc {
    private static final Logger log = LoggerFactory.getLogger(AttendanceJdbc.class);
    private final DataSource dataSource;

    public AttendanceJdbc(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    /** Batch upsert of holiday snapshots in ONE transaction: all rows or none. */
    public int upsertHolidays(List<HolidaySnapshot> holidays) {
        if (holidays.isEmpty()) return 0;
        String sql = "INSERT INTO holiday_snapshots (holiday_id, holiday_date, name, location_id) VALUES (?, ?, ?, ?) "
                + "ON DUPLICATE KEY UPDATE holiday_date = VALUES(holiday_date), name = VALUES(name), location_id = VALUES(location_id)";
        try (Connection c = dataSource.getConnection()) {
            boolean auto = c.getAutoCommit();
            c.setAutoCommit(false);
            try (PreparedStatement ps = c.prepareStatement(sql)) {
                for (HolidaySnapshot h : holidays) {
                    ps.setString(1, h.getHolidayId());
                    ps.setDate(2, java.sql.Date.valueOf(h.getHolidayDate()));
                    ps.setString(3, h.getName());
                    if (h.getLocationId() == null) ps.setNull(4, Types.VARCHAR); else ps.setString(4, h.getLocationId());
                    ps.addBatch();
                }
                int[] counts = ps.executeBatch();
                c.commit();
                return counts.length;
            } catch (SQLException e) {
                c.rollback();
                throw e;
            } finally {
                c.setAutoCommit(auto);
            }
        } catch (SQLException e) {
            log.error("Holiday snapshot batch failed: {}", e.getMessage());
            throw new ServiceUnavailableException("Could not store holiday snapshot");
        }
    }

    /** CALL sp_monthly_attendance_summary(employee, year, month, location): computes, stores (upsert) and returns the month. */
    public MonthlySummaryResponse monthlySummary(String employeeId, int year, int month, String locationId) {
        try (Connection c = dataSource.getConnection(); CallableStatement cs = c.prepareCall("{call sp_monthly_attendance_summary(?, ?, ?, ?)}")) {
            cs.setString(1, employeeId);
            cs.setInt(2, year);
            cs.setInt(3, month);
            if (locationId == null) cs.setNull(4, Types.VARCHAR); else cs.setString(4, locationId);
            boolean hasResult = cs.execute();
            while (!hasResult && cs.getUpdateCount() != -1) hasResult = cs.getMoreResults();   // skip update counts until the SELECT
            if (!hasResult) throw new SQLException("Procedure returned no result set");
            try (ResultSet rs = cs.getResultSet()) {
                if (!rs.next()) throw new SQLException("Procedure returned no row");
                Timestamp gen = rs.getTimestamp("generated_at");
                return new MonthlySummaryResponse(employeeId, year, month, rs.getInt("total_days"), rs.getInt("working_days"), rs.getInt("present_days"),
                        rs.getInt("half_days"), rs.getInt("absent_days"), rs.getInt("leave_days"), rs.getInt("holidays"), rs.getInt("weekly_offs"),
                        rs.getInt("wfh_days"), rs.getInt("missing_punches"), rs.getInt("late_count"), rs.getInt("late_minutes"), rs.getInt("early_count"),
                        rs.getInt("worked_minutes"), rs.getInt("overtime_minutes"), gen == null ? Instant.now() : gen.toInstant());
            }
        } catch (SQLException e) {
            log.error("sp_monthly_attendance_summary failed: {}", e.getMessage());
            throw new ServiceUnavailableException("Could not compute the monthly summary");
        }
    }
}
