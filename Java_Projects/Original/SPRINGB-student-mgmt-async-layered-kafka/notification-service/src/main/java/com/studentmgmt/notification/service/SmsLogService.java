package com.studentmgmt.notification.service;

import com.studentmgmt.notification.model.SmsLog;

import java.util.List;

public interface SmsLogService {

    List<SmsLog> findAll(Long notificationId);

    SmsLog findById(Long smsLogId);

    SmsLog create(SmsLog smsLog);
}
