package com.studentmgmt.notification.controller;

import com.studentmgmt.notification.dto.SendNotificationRequest;
import com.studentmgmt.notification.entity.Notification;
import com.studentmgmt.notification.service.NotificationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public List<Notification> findAll(@RequestParam(required = false) Long recipientId) {
        return notificationService.findAll(recipientId);
    }

    @GetMapping("/{id}")
    public Notification findById(@PathVariable Long id) {
        return notificationService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Notification create(@Valid @RequestBody Notification notification) {
        return notificationService.create(notification);
    }

    /** Called synchronously by enrollment-service after a successful payment. */
    @PostMapping("/send")
    @ResponseStatus(HttpStatus.CREATED)
    public Notification send(@Valid @RequestBody SendNotificationRequest request) {
        return notificationService.send(request);
    }

    @PutMapping("/{id}")
    public Notification update(@PathVariable Long id, @Valid @RequestBody Notification notification) {
        return notificationService.update(id, notification);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        notificationService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
