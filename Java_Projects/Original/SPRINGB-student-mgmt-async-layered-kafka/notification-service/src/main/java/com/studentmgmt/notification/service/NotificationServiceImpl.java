package com.studentmgmt.notification.service;

import com.studentmgmt.notification.dao.NotificationDao;
import com.studentmgmt.notification.exception.ResourceNotFoundException;
import com.studentmgmt.notification.model.Notification;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class NotificationServiceImpl implements NotificationService {

    private final NotificationDao notificationDao;

    public NotificationServiceImpl(NotificationDao notificationDao) {
        this.notificationDao = notificationDao;
    }

    @Override
    public List<Notification> findAll(Long recipientId, Long enrollmentId) {
        if (recipientId != null) {
            return notificationDao.findByRecipientId(recipientId);
        }
        if (enrollmentId != null) {
            return notificationDao.findByEnrollmentId(enrollmentId);
        }
        return notificationDao.findAll();
    }

    @Override
    public Notification findById(Long id) {
        return notificationDao.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found: " + id));
    }

    @Override
    public Notification create(Notification notification) {
        return notificationDao.save(notification);
    }

    @Override
    public Notification update(Long id, Notification notification) {
        findById(id);
        return notificationDao.update(id, notification);
    }

    @Override
    public void delete(Long id) {
        findById(id);
        notificationDao.deleteById(id);
    }
}
