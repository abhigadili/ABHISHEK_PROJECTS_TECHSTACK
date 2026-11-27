package com.studentmgmt.notification.service;

import com.studentmgmt.notification.entity.EmailLog;
import com.studentmgmt.notification.entity.Notification;
import com.studentmgmt.notification.entity.SmsLog;
import com.studentmgmt.notification.event.EnrollmentOutcomeEvent;
import com.studentmgmt.notification.repository.EmailLogRepository;
import com.studentmgmt.notification.repository.NotificationRepository;
import com.studentmgmt.notification.repository.SmsLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Reacts to the outcome of the enrollment saga: on CONFIRMED it "sends" an
 * email + SMS to the student, on REJECTED it "sends" an explanatory email
 * only. There is no real email/SMS gateway here (out of scope, same as the
 * synchronous/OpenFeign version of this system) — rows are written straight
 * to SENT to simulate a successful send.
 */
@Service
public class EnrollmentOutcomeService {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentOutcomeService.class);

    private final NotificationRepository notificationRepository;
    private final EmailLogRepository emailLogRepository;
    private final SmsLogRepository smsLogRepository;

    public EnrollmentOutcomeService(NotificationRepository notificationRepository,
                                     EmailLogRepository emailLogRepository,
                                     SmsLogRepository smsLogRepository) {
        this.notificationRepository = notificationRepository;
        this.emailLogRepository = emailLogRepository;
        this.smsLogRepository = smsLogRepository;
    }

    @Transactional
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
        notification = notificationRepository.save(notification);

        EmailLog emailLog = new EmailLog();
        emailLog.setNotificationId(notification.getNotificationId());
        emailLog.setToEmail(toEmail);
        emailLog.setSubject(subject);
        emailLog.setBody(message);
        emailLog.setStatus("SENT");
        emailLog.setSentAt(LocalDateTime.now());
        emailLogRepository.save(emailLog);

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
        notification = notificationRepository.save(notification);

        SmsLog smsLog = new SmsLog();
        smsLog.setNotificationId(notification.getNotificationId());
        smsLog.setToPhone("N/A");
        smsLog.setMessage(message);
        smsLog.setStatus("SENT");
        smsLog.setSentAt(LocalDateTime.now());
        smsLogRepository.save(smsLog);

        return notification;
    }
}
