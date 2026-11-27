package com.studentmgmt.notification.command.service;

import com.studentmgmt.notification.command.entity.Notification;
import com.studentmgmt.notification.entity.EmailLog;
import com.studentmgmt.notification.entity.SmsLog;
import com.studentmgmt.notification.event.EnrollmentOutcomeEvent;
import com.studentmgmt.notification.service.EmailLogService;
import com.studentmgmt.notification.service.SmsLogService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * Reacts to the outcome of the enrollment saga: on CONFIRMED it "sends" an
 * email + SMS to the student, on REJECTED it "sends" an explanatory email
 * only. There is no real email/SMS gateway here (out of scope, same as the
 * sibling projects) — rows are written straight to SENT to simulate a
 * successful send. Funnels through NotificationCommandService.create() —
 * the same write path a manual POST /api/notifications uses — so there's
 * exactly one place that publishes NotificationChangedEvent.
 */
@Service
public class EnrollmentOutcomeService {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentOutcomeService.class);

    private final NotificationCommandService notificationCommandService;
    private final EmailLogService emailLogService;
    private final SmsLogService smsLogService;

    public EnrollmentOutcomeService(NotificationCommandService notificationCommandService,
                                     EmailLogService emailLogService,
                                     SmsLogService smsLogService) {
        this.notificationCommandService = notificationCommandService;
        this.emailLogService = emailLogService;
        this.smsLogService = smsLogService;
    }

    public void handle(EnrollmentOutcomeEvent event) {
        boolean confirmed = "CONFIRMED".equalsIgnoreCase(event.getStatus());
        String eventType = confirmed ? "ENROLLMENT_CONFIRMED" : "ENROLLMENT_REJECTED";
        String placeholderEmail = "student" + event.getStudentId() + "@example.com";

        String subject = confirmed ? "Enrollment Confirmed" : "Enrollment Rejected";
        String message = confirmed
                ? "Your enrollment (id " + event.getEnrollmentId() + ") in course " + event.getCourseId() + " is confirmed."
                : "Your enrollment (id " + event.getEnrollmentId() + ") in course " + event.getCourseId() +
                        " was rejected: " + event.getReason();

        Notification emailNotification = sendEmail(event, eventType, subject, message, placeholderEmail);
        log.info("Recorded {} email notification {} for enrollment {}", eventType, emailNotification.getNotificationId(), event.getEnrollmentId());

        if (confirmed) {
            Notification smsNotification = sendSms(event, eventType, message);
            log.info("Recorded {} SMS notification {} for enrollment {}", eventType, smsNotification.getNotificationId(), event.getEnrollmentId());
        }
    }

    private Notification sendEmail(EnrollmentOutcomeEvent event, String eventType, String subject, String message, String toEmail) {
        Notification notification = new Notification();
        notification.setEnrollmentId(event.getEnrollmentId());
        notification.setRecipientId(event.getStudentId());
        notification.setRecipientType("STUDENT");
        notification.setEventType(eventType);
        notification.setChannel("EMAIL");
        notification.setSubject(subject);
        notification.setMessage(message);
        notification.setStatus("SENT");
        notification.setSentAt(LocalDateTime.now());
        notification = notificationCommandService.create(notification);

        EmailLog emailLog = new EmailLog();
        emailLog.setNotificationId(notification.getNotificationId());
        emailLog.setToEmail(toEmail);
        emailLog.setSubject(subject);
        emailLog.setBody(message);
        emailLog.setStatus("SENT");
        emailLog.setSentAt(LocalDateTime.now());
        emailLogService.create(emailLog);

        return notification;
    }

    private Notification sendSms(EnrollmentOutcomeEvent event, String eventType, String message) {
        Notification notification = new Notification();
        notification.setEnrollmentId(event.getEnrollmentId());
        notification.setRecipientId(event.getStudentId());
        notification.setRecipientType("STUDENT");
        notification.setEventType(eventType);
        notification.setChannel("SMS");
        notification.setMessage(message);
        notification.setStatus("SENT");
        notification.setSentAt(LocalDateTime.now());
        notification = notificationCommandService.create(notification);

        SmsLog smsLog = new SmsLog();
        smsLog.setNotificationId(notification.getNotificationId());
        smsLog.setToPhone("N/A");
        smsLog.setMessage(message);
        smsLog.setStatus("SENT");
        smsLog.setSentAt(LocalDateTime.now());
        smsLogService.create(smsLog);

        return notification;
    }
}
