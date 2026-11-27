package com.studentmgmt.notification.service;

import com.studentmgmt.notification.entity.EmailLog;
import com.studentmgmt.notification.exception.ResourceNotFoundException;
import com.studentmgmt.notification.repository.EmailLogRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class EmailLogService {

    private final EmailLogRepository emailLogRepository;

    public EmailLogService(EmailLogRepository emailLogRepository) {
        this.emailLogRepository = emailLogRepository;
    }

    public List<EmailLog> findAll(Long notificationId) {
        if (notificationId != null) {
            return emailLogRepository.findByNotificationId(notificationId);
        }
        return emailLogRepository.findAll();
    }

    public EmailLog findById(Long id) {
        return emailLogRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Email log not found: " + id));
    }

    public EmailLog create(EmailLog log) {
        return emailLogRepository.save(log);
    }
}
