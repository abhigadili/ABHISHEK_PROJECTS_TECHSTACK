package com.studentmgmt.notification.query.service;

import com.studentmgmt.notification.exception.ResourceNotFoundException;
import com.studentmgmt.notification.query.entity.NotificationView;
import com.studentmgmt.notification.query.repository.NotificationQueryRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class NotificationQueryService {

    private final NotificationQueryRepository notificationQueryRepository;

    public NotificationQueryService(NotificationQueryRepository notificationQueryRepository) {
        this.notificationQueryRepository = notificationQueryRepository;
    }

    public List<NotificationView> findAll(Long recipientId, Long enrollmentId) {
        if (recipientId != null) {
            return notificationQueryRepository.findByRecipientId(recipientId);
        }
        if (enrollmentId != null) {
            return notificationQueryRepository.findByEnrollmentId(enrollmentId);
        }
        return notificationQueryRepository.findAll();
    }

    public NotificationView findById(Long id) {
        return notificationQueryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found: " + id));
    }
}
