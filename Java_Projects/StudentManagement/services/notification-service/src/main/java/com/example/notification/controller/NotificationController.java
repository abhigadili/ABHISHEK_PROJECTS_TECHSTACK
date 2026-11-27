package com.example.notification.controller;

import com.example.common.security.AuthenticatedUser;
import com.example.notification.dto.NotificationResponse;
import com.example.notification.entity.NotificationStatus;
import com.example.notification.entity.NotificationType;
import com.example.notification.service.NotificationQueryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/notifications")
@Tag(name = "Notifications", description = "Notification history (notifications are created by Kafka consumers, not by API calls)")
public class NotificationController {
    private final NotificationQueryService service;

    public NotificationController(NotificationQueryService service) { this.service = service; }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    @Operation(summary = "Search notification history (paged)")
    public Page<NotificationResponse> search(@RequestParam(required = false) Long studentId, @RequestParam(required = false) NotificationStatus status,
                                             @RequestParam(required = false) NotificationType type, @RequestParam(defaultValue = "0") int page,
                                             @RequestParam(defaultValue = "10") int size) {
        return service.search(studentId, status, type, PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by(Sort.Direction.DESC, "notificationId")));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    @Operation(summary = "Get one notification")
    public NotificationResponse get(@PathVariable Long id) { return service.get(id); }

    @GetMapping("/student/{studentId}")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF') or (hasRole('STUDENT') and #user.studentId == #studentId)")
    @Operation(summary = "Notification history of a student (STUDENT: own only)")
    public Page<NotificationResponse> forStudent(@PathVariable Long studentId, @AuthenticationPrincipal AuthenticatedUser user,
                                                 @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
        return service.forStudent(studentId, PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by(Sort.Direction.DESC, "notificationId")));
    }

    @PostMapping("/{id}/retry")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    @Operation(summary = "Re-queue a FAILED notification")
    public NotificationResponse retry(@PathVariable Long id) { return service.retry(id); }
}
