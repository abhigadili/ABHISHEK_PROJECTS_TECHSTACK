package com.studentmgmt.notification.dao;

import com.studentmgmt.notification.model.EmailLog;

import java.util.List;
import java.util.Optional;

public interface EmailLogDao {

    List<EmailLog> findAll();

    List<EmailLog> findByNotificationId(Long notificationId);

    Optional<EmailLog> findById(Long emailLogId);

    EmailLog save(EmailLog emailLog);
}
