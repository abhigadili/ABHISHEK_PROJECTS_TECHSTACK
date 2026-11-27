package com.studentmgmt.notification.dao;

import com.studentmgmt.notification.model.EmailLog;
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
public class EmailLogDaoImpl implements EmailLogDao {

    private final JdbcTemplate jdbcTemplate;

    public EmailLogDaoImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static EmailLog mapRow(ResultSet rs, int rowNum) throws java.sql.SQLException {
        EmailLog emailLog = new EmailLog();
        emailLog.setEmailLogId(rs.getLong("email_log_id"));
        emailLog.setNotificationId(rs.getLong("notification_id"));
        emailLog.setToEmail(rs.getString("to_email"));
        emailLog.setSubject(rs.getString("subject"));
        emailLog.setBody(rs.getString("body"));
        emailLog.setStatus(rs.getString("status"));
        java.sql.Timestamp sentAt = rs.getTimestamp("sent_at");
        emailLog.setSentAt(sentAt != null ? sentAt.toLocalDateTime() : null);
        emailLog.setErrorMessage(rs.getString("error_message"));
        return emailLog;
    }

    @Override
    public List<EmailLog> findAll() {
        return jdbcTemplate.query("SELECT * FROM Email_Logs ORDER BY email_log_id", EmailLogDaoImpl::mapRow);
    }

    @Override
    public List<EmailLog> findByNotificationId(Long notificationId) {
        return jdbcTemplate.query(
                "SELECT * FROM Email_Logs WHERE notification_id = ? ORDER BY email_log_id",
                EmailLogDaoImpl::mapRow, notificationId);
    }

    @Override
    public Optional<EmailLog> findById(Long emailLogId) {
        try {
            EmailLog emailLog = jdbcTemplate.queryForObject(
                    "SELECT * FROM Email_Logs WHERE email_log_id = ?", EmailLogDaoImpl::mapRow, emailLogId);
            return Optional.ofNullable(emailLog);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    @Override
    public EmailLog save(EmailLog emailLog) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO Email_Logs (notification_id, to_email, subject, body, status, sent_at, error_message) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS);
            ps.setLong(1, emailLog.getNotificationId());
            ps.setString(2, emailLog.getToEmail());
            ps.setString(3, emailLog.getSubject());
            ps.setString(4, emailLog.getBody());
            ps.setString(5, emailLog.getStatus() != null ? emailLog.getStatus() : "PENDING");
            if (emailLog.getSentAt() != null) {
                ps.setTimestamp(6, java.sql.Timestamp.valueOf(emailLog.getSentAt()));
            } else {
                ps.setNull(6, Types.TIMESTAMP);
            }
            ps.setString(7, emailLog.getErrorMessage());
            return ps;
        }, keyHolder);

        Long newId = keyHolder.getKey().longValue();
        return findById(newId).orElseThrow();
    }
}
