package com.studentmgmt.notification.service;

import com.studentmgmt.notification.dto.SendNotificationRequest;
import com.studentmgmt.notification.entity.EmailLog;
import com.studentmgmt.notification.entity.Notification;
import com.studentmgmt.notification.entity.SmsLog;
import com.studentmgmt.notification.exception.ResourceNotFoundException;
import com.studentmgmt.notification.repository.EmailLogRepository;
import com.studentmgmt.notification.repository.NotificationRepository;
import com.studentmgmt.notification.repository.SmsLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final EmailLogRepository emailLogRepository;
    private final SmsLogRepository smsLogRepository;

    public NotificationService(NotificationRepository notificationRepository,
                                EmailLogRepository emailLogRepository,
                                SmsLogRepository smsLogRepository) {
        this.notificationRepository = notificationRepository;
        this.emailLogRepository = emailLogRepository;
        this.smsLogRepository = smsLogRepository;
    }

    public List<Notification> findAll(Long recipientId) {
        if (recipientId != null) {
            return notificationRepository.findByRecipientId(recipientId);
        }
        return notificationRepository.findAll();
    }

    public Notification findById(Long id) {
        return notificationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found: " + id));
    }

    public Notification create(Notification notification) {
        return notificationRepository.save(notification);
    }

    public Notification update(Long id, Notification notification) {
        Notification existing = findById(id);
        existing.setRecipientId(notification.getRecipientId());
        existing.setRecipientType(notification.getRecipientType());
        existing.setChannel(notification.getChannel());
        existing.setSubject(notification.getSubject());
        existing.setMessage(notification.getMessage());
        existing.setStatus(notification.getStatus());
        existing.setSentAt(notification.getSentAt());
        return notificationRepository.save(existing);
    }

    public void delete(Long id) {
        findById(id);
        notificationRepository.deleteById(id);
    }

    /**
     * Called synchronously by enrollment-service right after a payment succeeds.
     * Creates the Notification row plus the matching Email_Logs or SMS_Logs row,
     * and marks both SENT — this stands in for an actual email/SMS gateway call,
     * which is out of scope here.
     */
    @Transactional
    public Notification send(SendNotificationRequest request) {
        Notification notification = new Notification();
        notification.setRecipientId(request.getRecipientId());
        notification.setRecipientType(request.getRecipientType());
        notification.setChannel(request.getChannel());
        notification.setSubject(request.getSubject());
        notification.setMessage(request.getMessage());
        notification.setStatus("SENT");
        notification.setSentAt(LocalDateTime.now());
        notification = notificationRepository.save(notification);

        if ("EMAIL".equalsIgnoreCase(request.getChannel())) {
            EmailLog log = new EmailLog();
            log.setNotificationId(notification.getNotificationId());
            log.setToEmail(request.getToEmail());
            log.setSubject(request.getSubject());
            log.setBody(request.getMessage());
            log.setStatus("SENT");
            log.setSentAt(LocalDateTime.now());
            emailLogRepository.save(log);
        } else if ("SMS".equalsIgnoreCase(request.getChannel())) {
            SmsLog log = new SmsLog();
            log.setNotificationId(notification.getNotificationId());
            log.setToPhone(request.getToPhone());
            log.setMessage(request.getMessage());
            log.setStatus("SENT");
            log.setSentAt(LocalDateTime.now());
            smsLogRepository.save(log);
        }

        return notification;
    }
}
