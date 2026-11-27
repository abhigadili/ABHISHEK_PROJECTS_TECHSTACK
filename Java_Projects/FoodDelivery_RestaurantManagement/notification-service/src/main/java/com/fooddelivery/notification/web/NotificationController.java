package com.fooddelivery.notification.web;

import com.fooddelivery.common.web.PageResponse;
import com.fooddelivery.notification.service.NotificationService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@Tag(name = "Notifications")
public class NotificationController {
    private final NotificationService service;

    public NotificationController(NotificationService service) { this.service = service; }

    @GetMapping
    public PageResponse<Dtos.NotificationDto> mine(@RequestParam(defaultValue = "false") boolean unreadOnly, @RequestParam(defaultValue = "0") int page,
                                                   @RequestParam(defaultValue = "20") int size) {
        return PageResponse.of(service.mine(unreadOnly, page, size), n -> n);
    }

    @GetMapping("/unread-count")
    public Dtos.UnreadCount unread() { return new Dtos.UnreadCount(service.unread()); }

    @PatchMapping("/{id}/read")
    public Dtos.NotificationDto read(@PathVariable Long id) { return service.markRead(id); }

    @PostMapping("/read-all")
    public Map<String, Integer> readAll() { return Map.of("updated", service.markAllRead()); }

    @GetMapping("/admin/history")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public PageResponse<Dtos.NotificationDto> history(@RequestParam(required = false) Long userId, @RequestParam(defaultValue = "0") int page,
                                                      @RequestParam(defaultValue = "30") int size) {
        return PageResponse.of(service.history(userId, page, size), n -> n);
    }

    @GetMapping("/admin/stats")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN','SERVICE')")
    public Dtos.Stats stats() { return service.stats(); }
}
