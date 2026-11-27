package com.example.notification.service;

import com.example.events.EnrollmentEvent;
import com.example.events.LowCourseAvailabilityEvent;
import com.example.notification.entity.InboxMessage;
import com.example.notification.entity.Notification;
import com.example.notification.entity.NotificationType;
import com.example.notification.repository.InboxMessageRepository;
import com.example.notification.repository.NotificationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Turns integration events into PENDING notifications. Inbox row + notification are written in ONE transaction, so
 * a redelivered event (same eventId) is detected and skipped, and a crash can never leave only half of the work.
 */
@Service
public class NotificationIngestService {
    public static final String CONSUMER_GROUP = "notification-service";
    private static final Logger log = LoggerFactory.getLogger(NotificationIngestService.class);

    private final InboxMessageRepository inbox;
    private final NotificationRepository notifications;
    private final String adminEmail;

    public NotificationIngestService(InboxMessageRepository inbox, NotificationRepository notifications,
                                     @Value("${notification.admin-email}") String adminEmail) {
        this.inbox = inbox; this.notifications = notifications; this.adminEmail = adminEmail;
    }

    /** @return true if a new notification was created */
    @Transactional
    public boolean handleEnrollmentEvent(EnrollmentEvent e, String topic) {
        if (inbox.existsByMessageIdAndConsumerGroup(e.eventId(), CONSUMER_GROUP)) {
            log.info("Duplicate event ignored eventId={} type={}", e.eventId(), e.eventType());
            return false;
        }
        inbox.saveAndFlush(new InboxMessage(e.eventId(), topic, CONSUMER_GROUP));

        NotificationType type = switch (e.eventType()) {
            case EnrollmentConfirmed -> NotificationType.ENROLLMENT_CONFIRMED;
            case EnrollmentRejected -> NotificationType.ENROLLMENT_REJECTED;
            case EnrollmentCancelled -> NotificationType.ENROLLMENT_CANCELLED;
            case EnrollmentRequested -> null;     // acknowledged (inbox) but no user-facing notification
        };
        if (type == null) {
            log.info("EnrollmentRequested recorded enrollment={} (no notification)", e.enrollmentId());
            return false;
        }
        if (e.enrollmentId() != null && notifications.existsByEnrollmentIdAndNotificationType(e.enrollmentId(), type)) {
            log.info("Notification already exists enrollment={} type={}", e.enrollmentId(), type);
            return false;
        }
        Notification n = new Notification();
        n.setStudentId(e.studentId());
        n.setEnrollmentId(e.enrollmentId());
        n.setNotificationType(type);
        n.setRecipientEmail(e.studentEmail());
        n.setMessage(message(type, e));
        notifications.save(n);
        log.info("Notification queued type={} enrollment={} student={}", type, e.enrollmentId(), e.studentId());
        return true;
    }

    @Transactional
    public boolean handleLowAvailability(LowCourseAvailabilityEvent e, String topic) {
        if (inbox.existsByMessageIdAndConsumerGroup(e.eventId(), CONSUMER_GROUP)) return false;
        inbox.saveAndFlush(new InboxMessage(e.eventId(), topic, CONSUMER_GROUP));
        Notification n = new Notification();
        n.setNotificationType(NotificationType.COURSE_LOW_AVAILABILITY);
        n.setRecipientEmail(adminEmail);
        n.setMessage("Course " + e.courseName() + " (" + e.courseCode() + ") is running low on seats: "
                + e.availableSeats() + " of " + e.totalSeats() + " remaining.");
        notifications.save(n);
        log.info("Low-availability notification queued course={} available={}", e.courseId(), e.availableSeats());
        return true;
    }

    static String message(NotificationType type, EnrollmentEvent e) {
        String name = e.studentName() == null ? "Student" : e.studentName();
        String course = e.courseName() == null ? "course #" + e.courseId() : e.courseName();
        return switch (type) {
            case ENROLLMENT_CONFIRMED -> "Hi " + name + ", your enrollment #" + e.enrollmentId() + " in " + course + " is confirmed.";
            case ENROLLMENT_REJECTED -> "Hi " + name + ", your enrollment request for " + course + " was rejected"
                    + (e.reason() == null ? "." : ": " + e.reason());
            case ENROLLMENT_CANCELLED -> "Hi " + name + ", your enrollment #" + e.enrollmentId() + " in " + course + " has been cancelled.";
            default -> throw new IllegalArgumentException(type.name());
        };
    }
}
