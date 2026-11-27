package com.studentmgmt.notification.service;

import com.studentmgmt.notification.entity.Notification;
import com.studentmgmt.notification.exception.ResourceNotFoundException;
import com.studentmgmt.notification.repository.NotificationRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    public List<Notification> findAll(Long recipientId, Long enrollmentId) {
        if (recipientId != null) {
            return notificationRepository.findByRecipientId(recipientId);
        }
        if (enrollmentId != null) {
            return notificationRepository.findByEnrollmentId(enrollmentId);
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
}
