package com.hrportal.notification.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.hrportal.notification.entity.ContactProjection;
import com.hrportal.notification.entity.EmailSetting;
import com.hrportal.notification.entity.Enums.Channel;
import com.hrportal.notification.entity.Enums.DeliveryStatus;
import com.hrportal.notification.entity.EventHistory;
import com.hrportal.notification.entity.Notification;
import com.hrportal.notification.entity.NotificationTemplate;

public final class NotificationRepositories {
    private NotificationRepositories() {
    }

    public interface TemplateRepository extends JpaRepository<NotificationTemplate, String> {
        Optional<NotificationTemplate> findByCodeAndActiveTrue(String code);

        Optional<NotificationTemplate> findByCode(String code);
    }

    public interface NotificationRepository extends JpaRepository<Notification, String> {
        Page<Notification> findByRecipientEmployeeIdAndChannel(String employeeId, Channel channel, Pageable pageable);

        Page<Notification> findByRecipientEmployeeIdAndChannelAndReadAtIsNull(String employeeId, Channel channel, Pageable pageable);

        long countByRecipientEmployeeIdAndChannelAndReadAtIsNull(String employeeId, Channel channel);

        List<Notification> findByStatusAndChannelAndCreatedAtBefore(DeliveryStatus status, Channel channel, Instant before);

        @Modifying
        @Query("update Notification n set n.readAt = :now where n.recipientEmployeeId = :employeeId and n.channel = com.hrportal.notification.entity.Enums$Channel.IN_APP and n.readAt is null")
        int markAllRead(@Param("employeeId") String employeeId, @Param("now") Instant now);

        @Query("select n from Notification n where (:employeeId is null or n.recipientEmployeeId = :employeeId) and (:type is null or n.type = :type) "
                + "and (:status is null or n.status = :status)")
        Page<Notification> search(@Param("employeeId") String employeeId, @Param("type") String type, @Param("status") DeliveryStatus status, Pageable pageable);
    }

    public interface EmailSettingRepository extends JpaRepository<EmailSetting, String> {
    }

    public interface EventHistoryRepository extends JpaRepository<EventHistory, String> {
        boolean existsByEventId(String eventId);

        @Query("select e from EventHistory e where (:topic is null or e.topic = :topic) and (:employeeId is null or e.employeeId = :employeeId)")
        Page<EventHistory> search(@Param("topic") String topic, @Param("employeeId") String employeeId, Pageable pageable);
    }

    public interface ContactRepository extends JpaRepository<ContactProjection, String> {
    }
}
