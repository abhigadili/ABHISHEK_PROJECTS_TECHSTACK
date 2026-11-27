package com.studentmgmt.notification.service;

import com.studentmgmt.notification.model.EmailLog;

import java.util.List;

public interface EmailLogService {

    List<EmailLog> findAll(Long notificationId);

    EmailLog findById(Long emailLogId);

    EmailLog create(EmailLog emailLog);
}
