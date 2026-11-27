package com.hrportal.notification.controller;

import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.hrportal.common.persistence.BeanMapper;
import com.hrportal.common.web.PageRequests;
import com.hrportal.common.web.PageResponse;
import com.hrportal.notification.dto.NotificationDtos.EmailSettingRequest;
import com.hrportal.notification.dto.NotificationDtos.EmailSettingResponse;
import com.hrportal.notification.dto.NotificationDtos.EventHistoryResponse;
import com.hrportal.notification.dto.NotificationDtos.KafkaOverview;
import com.hrportal.notification.dto.NotificationDtos.NotificationResponse;
import com.hrportal.notification.dto.NotificationDtos.SendRequest;
import com.hrportal.notification.dto.NotificationDtos.TemplateRequest;
import com.hrportal.notification.dto.NotificationDtos.TemplateResponse;
import com.hrportal.notification.dto.NotificationDtos.UnreadCount;
import com.hrportal.notification.repository.NotificationRepositories.EventHistoryRepository;
import com.hrportal.notification.service.KafkaInfoService;
import com.hrportal.notification.service.NotificationService;
import com.hrportal.notification.service.TemplateSettingsService.EmailSettingsService;
import com.hrportal.notification.service.TemplateSettingsService.TemplateService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@Tag(name = "Notifications")
@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {
    private static final Set<String> SORT = Set.of("createdAt", "type", "status");
    private static final Set<String> EVENT_SORT = Set.of("occurredAt", "topic");
    private final NotificationService service;
    private final TemplateService templates;
    private final EmailSettingsService settings;
    private final KafkaInfoService kafka;
    private final EventHistoryRepository events;

    public NotificationController(NotificationService service, TemplateService templates, EmailSettingsService settings, KafkaInfoService kafka, EventHistoryRepository events) {
        this.service = service;
        this.templates = templates;
        this.settings = settings;
        this.kafka = kafka;
        this.events = events;
    }

    // ---- my inbox
    @Operation(summary = "My in-app notifications (newest first; unreadOnly filter)")
    @GetMapping("/me")
    public PageResponse<NotificationResponse> inbox(@RequestParam(defaultValue = "false") boolean unreadOnly, @RequestParam(defaultValue = "0") int page,
                                                    @RequestParam(defaultValue = "20") int size, @RequestParam(defaultValue = "createdAt,desc") String sort) {
        return PageResponse.of(service.inbox(unreadOnly, PageRequests.of(page, size, sort, SORT, "createdAt")));
    }

    @GetMapping("/me/unread-count")
    public UnreadCount unread() {
        return new UnreadCount(service.unreadCount());
    }

    @PatchMapping("/{id}/read")
    public NotificationResponse read(@PathVariable String id) {
        return service.markRead(id);
    }

    @PostMapping("/read-all")
    public Map<String, Integer> readAll() {
        return Map.of("marked", service.markAllRead());
    }

    // ---- administration
    @Operation(summary = "Notification history of everybody (filter by employee / type / delivery status)")
    @GetMapping("/history")
    @PreAuthorize("hasAuthority('PERM_NOTIFICATION_MANAGE')")
    public PageResponse<NotificationResponse> history(@RequestParam(required = false) String employeeId, @RequestParam(required = false) String type,
                                                      @RequestParam(required = false) String status, @RequestParam(defaultValue = "0") int page,
                                                      @RequestParam(defaultValue = "20") int size, @RequestParam(defaultValue = "createdAt,desc") String sort) {
        return PageResponse.of(service.history(employeeId, type, status, PageRequests.of(page, size, sort, SORT, "createdAt")));
    }

    @PostMapping("/send")
    @PreAuthorize("hasAuthority('PERM_NOTIFICATION_MANAGE')")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public Map<String, String> send(@Valid @RequestBody SendRequest req) {
        service.sendManual(req);
        return Map.of("status", "queued");
    }

    @GetMapping("/templates")
    @PreAuthorize("hasAuthority('PERM_NOTIFICATION_MANAGE')")
    public List<TemplateResponse> templates() {
        return templates.all();
    }

    @PostMapping("/templates")
    @PreAuthorize("hasAuthority('PERM_NOTIFICATION_MANAGE')")
    @ResponseStatus(HttpStatus.CREATED)
    public TemplateResponse createTemplate(@Valid @RequestBody TemplateRequest req) {
        return templates.create(req);
    }

    @PutMapping("/templates/{id}")
    @PreAuthorize("hasAuthority('PERM_NOTIFICATION_MANAGE')")
    public TemplateResponse updateTemplate(@PathVariable String id, @Valid @RequestBody TemplateRequest req) {
        return templates.update(id, req);
    }

    @Operation(summary = "E-mail settings (host, port, user, mode LOG / SMTP); the SMTP password comes from the environment")
    @GetMapping("/settings/email")
    @PreAuthorize("hasAuthority('PERM_NOTIFICATION_MANAGE')")
    public EmailSettingResponse emailSettings() {
        return settings.get();
    }

    @PutMapping("/settings/email")
    @PreAuthorize("hasAuthority('PERM_NOTIFICATION_MANAGE')")
    public EmailSettingResponse updateEmailSettings(@Valid @RequestBody EmailSettingRequest req) {
        return settings.update(req);
    }

    // ---- Kafka information (API only - no dashboard)
    @Operation(summary = "Kafka topics with partitions and message counts, including retry and dead-letter topics")
    @GetMapping("/kafka/topics")
    @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
    public KafkaOverview topics() {
        return kafka.overview();
    }

    @Operation(summary = "Business event history of all services (who published what, when, partition / offset)")
    @GetMapping("/events/history")
    @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
    public PageResponse<EventHistoryResponse> eventHistory(@RequestParam(required = false) String topic, @RequestParam(required = false) String employeeId,
                                                           @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
                                                           @RequestParam(defaultValue = "occurredAt,desc") String sort) {
        return PageResponse.of(events.search(topic, employeeId, PageRequests.of(page, size, sort, EVENT_SORT, "occurredAt")).map(e -> BeanMapper.toRecord(e, EventHistoryResponse.class)));
    }
}
