package com.studentmgmt.notification.service;

import com.studentmgmt.notification.entity.SmsLog;
import com.studentmgmt.notification.exception.ResourceNotFoundException;
import com.studentmgmt.notification.repository.SmsLogRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SmsLogService {

    private final SmsLogRepository smsLogRepository;

    public SmsLogService(SmsLogRepository smsLogRepository) {
        this.smsLogRepository = smsLogRepository;
    }

    public List<SmsLog> findAll(Long notificationId) {
        if (notificationId != null) {
            return smsLogRepository.findByNotificationId(notificationId);
        }
        return smsLogRepository.findAll();
    }

    public SmsLog findById(Long id) {
        return smsLogRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("SMS log not found: " + id));
    }

    public SmsLog create(SmsLog log) {
        return smsLogRepository.save(log);
    }
}
