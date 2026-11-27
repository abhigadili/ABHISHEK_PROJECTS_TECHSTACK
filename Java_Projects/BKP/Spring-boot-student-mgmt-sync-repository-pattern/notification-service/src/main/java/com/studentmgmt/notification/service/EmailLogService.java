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

    public EmailLog update(Long id, EmailLog log) {
        EmailLog existing = findById(id);
        existing.setNotificationId(log.getNotificationId());
        existing.setToEmail(log.getToEmail());
        existing.setSubject(log.getSubject());
        existing.setBody(log.getBody());
        existing.setStatus(log.getStatus());
        existing.setSentAt(log.getSentAt());
        existing.setErrorMessage(log.getErrorMessage());
        return emailLogRepository.save(existing);
    }

    public void delete(Long id) {
        findById(id);
        emailLogRepository.deleteById(id);
    }
}
