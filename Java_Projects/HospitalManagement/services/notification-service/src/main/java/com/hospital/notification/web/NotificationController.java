package com.hospital.notification.web;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.hospital.common.web.PageResponse;
import com.hospital.notification.domain.Notification;
import com.hospital.notification.dto.NotificationDtos.*;
import com.hospital.notification.service.NotificationService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public PageResponse<NotificationResponse> search(@RequestParam(required = false) String eventType, @RequestParam(required = false) String email,
                                                     @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return PageResponse.of(service.search(eventType, email, page, size));
    }

    /** Notifications addressed to the e-mail of the logged-in user. */
    @GetMapping("/my")
    public PageResponse<NotificationResponse> mine(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return PageResponse.of(service.mine(page, size));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public NotificationResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping("/send")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public NotificationResponse send(@Valid @RequestBody SendRequest r) {
        Notification n = service.send(r.getRecipientEmail(), r.getRecipientPhone(), Notification.Channel.EMAIL, r.getSubject(), r.getMessage(), "MANUAL", null);
        return NotificationResponse.from(n);
    }
}
