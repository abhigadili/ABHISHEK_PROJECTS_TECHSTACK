package com.studentmgmt.notification.service;

import com.studentmgmt.notification.dao.EmailLogDao;
import com.studentmgmt.notification.dao.NotificationDao;
import com.studentmgmt.notification.dao.SmsLogDao;
import com.studentmgmt.notification.event.EnrollmentOutcomeEvent;
import com.studentmgmt.notification.model.EmailLog;
import com.studentmgmt.notification.model.Notification;
import com.studentmgmt.notification.model.SmsLog;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * Reacts to the outcome of the enrollment saga: on CONFIRMED it "sends" an
 * email + SMS to the student, on REJECTED it "sends" an explanatory email
 * only. There is no real email/SMS gateway here (out of scope, same as the
 * synchronous/OpenFeign version of this system) — rows are written straight
 * to SENT to simulate a successful send.
 */
@Service
public class EnrollmentOutcomeServiceImpl implements EnrollmentOutcomeService {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentOutcomeServiceImpl.class);

    private final NotificationDao notificationDao;
    private final EmailLogDao emailLogDao;
    private final SmsLogDao smsLogDao;

    public EnrollmentOutcomeServiceImpl(NotificationDao notificationDao, EmailLogDao emailLogDao, SmsLogDao smsLogDao) {
        this.notificationDao = notificationDao;
        this.emailLogDao = emailLogDao;
        this.smsLogDao = smsLogDao;
    }

    @Override
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
        notification = notificationDao.save(notification);

        EmailLog emailLog = new EmailLog();
        emailLog.setNotificationId(notification.getNotificationId());
        emailLog.setToEmail(toEmail);
        emailLog.setSubject(subject);
        emailLog.setBody(message);
        emailLog.setStatus("SENT");
        emailLog.setSentAt(LocalDateTime.now());
        emailLogDao.save(emailLog);

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
        notification = notificationDao.save(notification);

        SmsLog smsLog = new SmsLog();
        smsLog.setNotificationId(notification.getNotificationId());
        smsLog.setToPhone("N/A");
        smsLog.setMessage(message);
        smsLog.setStatus("SENT");
        smsLog.setSentAt(LocalDateTime.now());
        smsLogDao.save(smsLog);

        return notification;
    }
}
