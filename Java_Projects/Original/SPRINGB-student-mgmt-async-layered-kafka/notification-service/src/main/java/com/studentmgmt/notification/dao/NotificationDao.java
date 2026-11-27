package com.studentmgmt.notification.dao;

import com.studentmgmt.notification.model.Notification;

import java.util.List;
import java.util.Optional;

public interface NotificationDao {

    List<Notification> findAll();

    List<Notification> findByRecipientId(Long recipientId);

    List<Notification> findByEnrollmentId(Long enrollmentId);

    Optional<Notification> findById(Long notificationId);

    Notification save(Notification notification);

    Notification update(Long notificationId, Notification notification);

    void deleteById(Long notificationId);
}
