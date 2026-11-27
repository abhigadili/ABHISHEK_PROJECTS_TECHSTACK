package com.studentmgmt.notification.repository;

import com.studentmgmt.notification.entity.EmailLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EmailLogRepository extends JpaRepository<EmailLog, Long> {

    List<EmailLog> findByNotificationId(Long notificationId);
}
