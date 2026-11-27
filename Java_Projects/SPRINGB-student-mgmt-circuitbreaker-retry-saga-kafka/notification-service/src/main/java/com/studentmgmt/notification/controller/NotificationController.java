package com.studentmgmt.notification.controller;

import com.studentmgmt.notification.entity.Notification;
import com.studentmgmt.notification.exception.ResourceNotFoundException;
import com.studentmgmt.notification.repository.NotificationRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationRepository notificationRepository;

    public NotificationController(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @GetMapping
    public List<Notification> findAll(@RequestParam(required = false) Long enrollmentId) {
        return enrollmentId != null
                ? notificationRepository.findByEnrollmentId(enrollmentId)
                : notificationRepository.findAll();
    }

    @GetMapping("/{id}")
    public Notification findById(@PathVariable Long id) {
        return notificationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found with id: " + id));
    }
}
