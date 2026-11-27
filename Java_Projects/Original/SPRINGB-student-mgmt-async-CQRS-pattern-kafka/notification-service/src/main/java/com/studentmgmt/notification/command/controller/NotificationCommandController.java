package com.studentmgmt.notification.command.controller;

import com.studentmgmt.notification.command.entity.Notification;
import com.studentmgmt.notification.command.service.NotificationCommandService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Write-only: POST for manual creation. Reads go through NotificationQueryController. */
@RestController
@RequestMapping("/api/notifications")
public class NotificationCommandController {

    private final NotificationCommandService notificationCommandService;

    public NotificationCommandController(NotificationCommandService notificationCommandService) {
        this.notificationCommandService = notificationCommandService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Notification create(@Valid @RequestBody Notification notification) {
        return notificationCommandService.create(notification);
    }
}
