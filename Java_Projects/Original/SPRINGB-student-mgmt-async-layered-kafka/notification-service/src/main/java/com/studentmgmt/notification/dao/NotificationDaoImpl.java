package com.studentmgmt.notification.dao;

import com.studentmgmt.notification.model.Notification;
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
public class NotificationDaoImpl implements NotificationDao {

    private final JdbcTemplate jdbcTemplate;

    public NotificationDaoImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static Notification mapRow(ResultSet rs, int rowNum) throws java.sql.SQLException {
        Notification notification = new Notification();
        notification.setNotificationId(rs.getLong("notification_id"));
        Long enrollmentId = (Long) rs.getObject("enrollment_id");
        notification.setEnrollmentId(enrollmentId);
        notification.setRecipientId(rs.getLong("recipient_id"));
        notification.setRecipientType(rs.getString("recipient_type"));
        notification.setEventType(rs.getString("event_type"));
        notification.setChannel(rs.getString("channel"));
        notification.setSubject(rs.getString("subject"));
        notification.setMessage(rs.getString("message"));
        notification.setStatus(rs.getString("status"));
        java.sql.Timestamp createdAt = rs.getTimestamp("created_at");
        notification.setCreatedAt(createdAt != null ? createdAt.toLocalDateTime() : null);
        java.sql.Timestamp sentAt = rs.getTimestamp("sent_at");
        notification.setSentAt(sentAt != null ? sentAt.toLocalDateTime() : null);
        return notification;
    }

    @Override
    public List<Notification> findAll() {
        return jdbcTemplate.query("SELECT * FROM Notifications ORDER BY notification_id", NotificationDaoImpl::mapRow);
    }

    @Override
    public List<Notification> findByRecipientId(Long recipientId) {
        return jdbcTemplate.query(
                "SELECT * FROM Notifications WHERE recipient_id = ? ORDER BY notification_id",
                NotificationDaoImpl::mapRow, recipientId);
    }

    @Override
    public List<Notification> findByEnrollmentId(Long enrollmentId) {
        return jdbcTemplate.query(
                "SELECT * FROM Notifications WHERE enrollment_id = ? ORDER BY notification_id",
                NotificationDaoImpl::mapRow, enrollmentId);
    }

    @Override
    public Optional<Notification> findById(Long notificationId) {
        try {
            Notification notification = jdbcTemplate.queryForObject(
                    "SELECT * FROM Notifications WHERE notification_id = ?", NotificationDaoImpl::mapRow, notificationId);
            return Optional.ofNullable(notification);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    @Override
    public Notification save(Notification notification) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO Notifications (enrollment_id, recipient_id, recipient_type, event_type, channel, subject, message, status, sent_at) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS);
            if (notification.getEnrollmentId() != null) {
                ps.setLong(1, notification.getEnrollmentId());
            } else {
                ps.setNull(1, Types.BIGINT);
            }
            ps.setLong(2, notification.getRecipientId());
            ps.setString(3, notification.getRecipientType());
            ps.setString(4, notification.getEventType());
            ps.setString(5, notification.getChannel());
            ps.setString(6, notification.getSubject());
            ps.setString(7, notification.getMessage());
            ps.setString(8, notification.getStatus() != null ? notification.getStatus() : "PENDING");
            if (notification.getSentAt() != null) {
                ps.setTimestamp(9, java.sql.Timestamp.valueOf(notification.getSentAt()));
            } else {
                ps.setNull(9, Types.TIMESTAMP);
            }
            return ps;
        }, keyHolder);

        Long newId = keyHolder.getKey().longValue();
        return findById(newId).orElseThrow();
    }

    @Override
    public Notification update(Long notificationId, Notification notification) {
        jdbcTemplate.update(
                "UPDATE Notifications SET recipient_id = ?, recipient_type = ?, channel = ?, subject = ?, " +
                        "message = ?, status = ?, sent_at = ? WHERE notification_id = ?",
                notification.getRecipientId(), notification.getRecipientType(), notification.getChannel(),
                notification.getSubject(), notification.getMessage(), notification.getStatus(),
                notification.getSentAt(), notificationId);
        return findById(notificationId).orElseThrow();
    }

    @Override
    public void deleteById(Long notificationId) {
        jdbcTemplate.update("DELETE FROM Notifications WHERE notification_id = ?", notificationId);
    }
}
