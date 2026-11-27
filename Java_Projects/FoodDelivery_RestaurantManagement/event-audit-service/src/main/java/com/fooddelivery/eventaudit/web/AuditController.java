package com.fooddelivery.eventaudit.web;

import com.fooddelivery.common.web.PageResponse;
import com.fooddelivery.eventaudit.service.AuditQueryService;
import com.fooddelivery.eventaudit.service.ReplayService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

/** Persistent event audit history: what was published, and what every consumer group really did with it. */
@RestController
@RequestMapping("/api/audit")
@PreAuthorize("hasAuthority('PERM_KAFKA_MONITOR')")
@Tag(name = "Event Audit")
public class AuditController {
    private final AuditQueryService audit;
    private final ReplayService replay;

    public AuditController(AuditQueryService audit, ReplayService replay) {
        this.audit = audit;
        this.replay = replay;
    }

    @GetMapping("/events")
    public PageResponse<Dtos.AuditDto> events(@RequestParam(required = false) String role, @RequestParam(required = false) String topic, @RequestParam(required = false) String eventType,
                                              @RequestParam(required = false) String status, @RequestParam(required = false) String service, @RequestParam(required = false) String q,
                                              @RequestParam(required = false) Instant from, @RequestParam(required = false) Instant to,
                                              @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
        return PageResponse.of(audit.search(role, topic, eventType, status, service, q, from, to, false, page, size), a -> a);
    }

    @GetMapping("/failed")
    public PageResponse<Dtos.AuditDto> failed(@RequestParam(required = false) String topic, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
        return PageResponse.of(audit.search("CONSUMED", topic, null, null, null, null, null, null, true, page, size), a -> a);
    }

    @GetMapping("/events/{id}")
    public Dtos.AuditDto get(@PathVariable Long id) { return audit.get(id); }

    @GetMapping("/trace/{correlationId}")
    public List<Dtos.AuditDto> trace(@PathVariable String correlationId) { return audit.trace(correlationId); }

    @GetMapping("/stats")
    public Dtos.AuditStats stats() { return audit.stats(); }

    @PostMapping("/events/{id}/replay")
    @PreAuthorize("hasAuthority('PERM_KAFKA_REPLAY')")
    public Dtos.ReplayResult replay(@PathVariable Long id) { return replay.replay(id); }
}
