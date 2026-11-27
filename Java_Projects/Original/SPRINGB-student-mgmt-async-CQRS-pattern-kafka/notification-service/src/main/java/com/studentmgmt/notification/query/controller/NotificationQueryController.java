package com.studentmgmt.notification.query.controller;

import com.studentmgmt.notification.query.entity.NotificationView;
import com.studentmgmt.notification.query.service.NotificationQueryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Read-only: every GET here comes from Notifications_View, never from Notifications directly. */
@RestController
@RequestMapping("/api/notifications")
public class NotificationQueryController {

    private final NotificationQueryService notificationQueryService;

    public NotificationQueryController(NotificationQueryService notificationQueryService) {
        this.notificationQueryService = notificationQueryService;
    }

    @GetMapping
    public List<NotificationView> findAll(@RequestParam(required = false) Long recipientId,
                                           @RequestParam(required = false) Long enrollmentId) {
        return notificationQueryService.findAll(recipientId, enrollmentId);
    }

    @GetMapping("/{id}")
    public NotificationView findById(@PathVariable Long id) {
        return notificationQueryService.findById(id);
    }
}
