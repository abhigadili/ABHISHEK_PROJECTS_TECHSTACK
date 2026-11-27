package com.studentmgmt.notification.dao;

import com.studentmgmt.notification.model.SmsLog;

import java.util.List;
import java.util.Optional;

public interface SmsLogDao {

    List<SmsLog> findAll();

    List<SmsLog> findByNotificationId(Long notificationId);

    Optional<SmsLog> findById(Long smsLogId);

    SmsLog save(SmsLog smsLog);
}
