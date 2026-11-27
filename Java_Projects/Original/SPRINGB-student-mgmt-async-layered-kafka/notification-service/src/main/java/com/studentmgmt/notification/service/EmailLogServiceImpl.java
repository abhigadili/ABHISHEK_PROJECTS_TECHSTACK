package com.studentmgmt.notification.service;

import com.studentmgmt.notification.dao.EmailLogDao;
import com.studentmgmt.notification.exception.ResourceNotFoundException;
import com.studentmgmt.notification.model.EmailLog;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class EmailLogServiceImpl implements EmailLogService {

    private final EmailLogDao emailLogDao;

    public EmailLogServiceImpl(EmailLogDao emailLogDao) {
        this.emailLogDao = emailLogDao;
    }

    @Override
    public List<EmailLog> findAll(Long notificationId) {
        return notificationId != null ? emailLogDao.findByNotificationId(notificationId) : emailLogDao.findAll();
    }

    @Override
    public EmailLog findById(Long emailLogId) {
        return emailLogDao.findById(emailLogId)
                .orElseThrow(() -> new ResourceNotFoundException("Email log not found: " + emailLogId));
    }

    @Override
    public EmailLog create(EmailLog emailLog) {
        return emailLogDao.save(emailLog);
    }
}
