package com.studentmgmt.notification.dao;

import com.studentmgmt.notification.model.SmsLog;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.sql.Types;
import java.util.List;
import java.util.Optional;

@Repository
public class SmsLogDaoImpl implements SmsLogDao {

    private final JdbcTemplate jdbcTemplate;

    public SmsLogDaoImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static SmsLog mapRow(ResultSet rs, int rowNum) throws java.sql.SQLException {
        SmsLog smsLog = new SmsLog();
        smsLog.setSmsLogId(rs.getLong("sms_log_id"));
        smsLog.setNotificationId(rs.getLong("notification_id"));
        smsLog.setToPhone(rs.getString("to_phone"));
        smsLog.setMessage(rs.getString("message"));
        smsLog.setStatus(rs.getString("status"));
        java.sql.Timestamp sentAt = rs.getTimestamp("sent_at");
        smsLog.setSentAt(sentAt != null ? sentAt.toLocalDateTime() : null);
        smsLog.setErrorMessage(rs.getString("error_message"));
        return smsLog;
    }

    @Override
    public List<SmsLog> findAll() {
        return jdbcTemplate.query("SELECT * FROM SMS_Logs ORDER BY sms_log_id", SmsLogDaoImpl::mapRow);
    }

    @Override
    public List<SmsLog> findByNotificationId(Long notificationId) {
        return jdbcTemplate.query(
                "SELECT * FROM SMS_Logs WHERE notification_id = ? ORDER BY sms_log_id",
                SmsLogDaoImpl::mapRow, notificationId);
    }

    @Override
    public Optional<SmsLog> findById(Long smsLogId) {
        try {
            SmsLog smsLog = jdbcTemplate.queryForObject(
                    "SELECT * FROM SMS_Logs WHERE sms_log_id = ?", SmsLogDaoImpl::mapRow, smsLogId);
            return Optional.ofNullable(smsLog);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    @Override
    public SmsLog save(SmsLog smsLog) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO SMS_Logs (notification_id, to_phone, message, status, sent_at, error_message) " +
                            "VALUES (?, ?, ?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS);
            ps.setLong(1, smsLog.getNotificationId());
            ps.setString(2, smsLog.getToPhone());
            ps.setString(3, smsLog.getMessage());
            ps.setString(4, smsLog.getStatus() != null ? smsLog.getStatus() : "PENDING");
            if (smsLog.getSentAt() != null) {
                ps.setTimestamp(5, java.sql.Timestamp.valueOf(smsLog.getSentAt()));
            } else {
                ps.setNull(5, Types.TIMESTAMP);
            }
            ps.setString(6, smsLog.getErrorMessage());
            return ps;
        }, keyHolder);

        Long newId = keyHolder.getKey().longValue();
        return findById(newId).orElseThrow();
    }
}
