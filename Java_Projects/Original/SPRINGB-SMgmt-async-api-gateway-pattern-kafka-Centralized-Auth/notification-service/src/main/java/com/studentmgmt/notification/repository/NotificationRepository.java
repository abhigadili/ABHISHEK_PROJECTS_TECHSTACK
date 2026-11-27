package com.studentmgmt.notification.repository;

import com.studentmgmt.notification.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByRecipientId(Long recipientId);

    List<Notification> findByEnrollmentId(Long enrollmentId);
}
