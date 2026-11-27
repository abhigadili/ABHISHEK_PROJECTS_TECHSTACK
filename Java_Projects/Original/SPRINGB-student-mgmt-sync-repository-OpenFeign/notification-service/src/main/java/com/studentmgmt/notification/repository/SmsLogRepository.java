package com.studentmgmt.notification.repository;

import com.studentmgmt.notification.entity.SmsLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SmsLogRepository extends JpaRepository<SmsLog, Long> {

    List<SmsLog> findByNotificationId(Long notificationId);
}
