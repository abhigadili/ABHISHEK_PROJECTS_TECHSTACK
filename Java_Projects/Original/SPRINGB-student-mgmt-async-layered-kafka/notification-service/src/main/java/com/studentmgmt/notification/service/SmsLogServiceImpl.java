package com.studentmgmt.notification.service;

import com.studentmgmt.notification.dao.SmsLogDao;
import com.studentmgmt.notification.exception.ResourceNotFoundException;
import com.studentmgmt.notification.model.SmsLog;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SmsLogServiceImpl implements SmsLogService {

    private final SmsLogDao smsLogDao;

    public SmsLogServiceImpl(SmsLogDao smsLogDao) {
        this.smsLogDao = smsLogDao;
    }

    @Override
    public List<SmsLog> findAll(Long notificationId) {
        return notificationId != null ? smsLogDao.findByNotificationId(notificationId) : smsLogDao.findAll();
    }

    @Override
    public SmsLog findById(Long smsLogId) {
        return smsLogDao.findById(smsLogId)
                .orElseThrow(() -> new ResourceNotFoundException("SMS log not found: " + smsLogId));
    }

    @Override
    public SmsLog create(SmsLog smsLog) {
        return smsLogDao.save(smsLog);
    }
}
