package com.studentmgmt.notification.command.service;

import com.studentmgmt.notification.command.entity.Notification;
import com.studentmgmt.notification.command.repository.NotificationCommandRepository;
import com.studentmgmt.notification.event.NotificationChangedEvent;
import com.studentmgmt.notification.kafka.NotificationChangedProducer;
import org.springframework.stereotype.Service;

/**
 * The single write path for Notification — used both by
 * NotificationCommandController (manual POST) and by
 * EnrollmentOutcomeListener (the internal trigger reacting to
 * enrollment.confirmed/enrollment.rejected). Both callers funnel through
 * this one create() method, so there's exactly one place that publishes
 * NotificationChangedEvent.
 */
@Service
public class NotificationCommandService {

    private final NotificationCommandRepository notificationCommandRepository;
    private final NotificationChangedProducer notificationChangedProducer;

    public NotificationCommandService(NotificationCommandRepository notificationCommandRepository,
                                       NotificationChangedProducer notificationChangedProducer) {
        this.notificationCommandRepository = notificationCommandRepository;
        this.notificationChangedProducer = notificationChangedProducer;
    }

    public Notification create(Notification notification) {
        Notification saved = notificationCommandRepository.save(notification);
        notificationChangedProducer.publish(toEvent(NotificationChangedEvent.CREATED, saved));
        return saved;
    }

    private NotificationChangedEvent toEvent(String operation, Notification notification) {
        NotificationChangedEvent event = new NotificationChangedEvent();
        event.setOperation(operation);
        event.setNotificationId(notification.getNotificationId());
        event.setEnrollmentId(notification.getEnrollmentId());
        event.setRecipientId(notification.getRecipientId());
        event.setRecipientType(notification.getRecipientType());
        event.setEventType(notification.getEventType());
        event.setChannel(notification.getChannel());
        event.setSubject(notification.getSubject());
        event.setMessage(notification.getMessage());
        event.setStatus(notification.getStatus());
        event.setSentAt(notification.getSentAt() != null ? notification.getSentAt().toString() : null);
        return event;
    }
}
