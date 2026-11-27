package com.studentmgmt.notification.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studentmgmt.notification.event.NotificationChangedEvent;
import com.studentmgmt.notification.query.entity.NotificationView;
import com.studentmgmt.notification.query.repository.NotificationQueryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
public class NotificationChangedProjector {

    private static final Logger log = LoggerFactory.getLogger(NotificationChangedProjector.class);

    private final NotificationQueryRepository notificationQueryRepository;
    private final ObjectMapper objectMapper;

    public NotificationChangedProjector(NotificationQueryRepository notificationQueryRepository, ObjectMapper objectMapper) {
        this.notificationQueryRepository = notificationQueryRepository;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = "${app.kafka.topic.notification-changed}")
    public void onNotificationChanged(String message) {
        try {
            NotificationChangedEvent event = objectMapper.readValue(message, NotificationChangedEvent.class);
            log.info("Received notification.changed: {}", message);

            if (NotificationChangedEvent.DELETED.equals(event.getOperation())) {
                notificationQueryRepository.deleteById(event.getNotificationId());
                return;
            }

            NotificationView view = notificationQueryRepository.findById(event.getNotificationId()).orElseGet(NotificationView::new);
            view.setNotificationId(event.getNotificationId());
            view.setEnrollmentId(event.getEnrollmentId());
            view.setRecipientId(event.getRecipientId());
            view.setRecipientType(event.getRecipientType());
            view.setEventType(event.getEventType());
            view.setChannel(event.getChannel());
            view.setSubject(event.getSubject());
            view.setMessage(event.getMessage());
            view.setStatus(event.getStatus());
            view.setSentAt(event.getSentAt() != null ? LocalDateTime.parse(event.getSentAt()) : null);
            notificationQueryRepository.save(view);
        } catch (Exception e) {
            log.error("Failed to project notification.changed message: {}", message, e);
        }
    }
}
