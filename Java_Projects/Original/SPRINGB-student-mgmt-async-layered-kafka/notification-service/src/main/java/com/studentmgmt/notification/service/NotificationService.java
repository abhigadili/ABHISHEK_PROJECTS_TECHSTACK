package com.studentmgmt.notification.service;

import com.studentmgmt.notification.model.Notification;

import java.util.List;

public interface NotificationService {

    List<Notification> findAll(Long recipientId, Long enrollmentId);

    Notification findById(Long id);

    Notification create(Notification notification);

    Notification update(Long id, Notification notification);

    void delete(Long id);
}
