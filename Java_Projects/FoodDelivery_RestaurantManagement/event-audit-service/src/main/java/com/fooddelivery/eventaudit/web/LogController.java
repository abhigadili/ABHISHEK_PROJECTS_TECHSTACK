package com.fooddelivery.eventaudit.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fooddelivery.eventaudit.monitor.LogSearchService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;

/** Secure, read-only log search over Elasticsearch (ADMIN + PERM_LOG_VIEW). */
@RestController
@RequestMapping("/api/logs")
@PreAuthorize("hasAuthority('PERM_LOG_VIEW')")
@Tag(name = "Logging & Observability")
public class LogController {
    private final LogSearchService logs;

    public LogController(LogSearchService logs) { this.logs = logs; }

    @GetMapping("/config")
    public Map<String, Object> config() { return logs.config(); }

    @GetMapping("/search")
    public Map<String, Object> search(@RequestParam(required = false) String q, @RequestParam(required = false) String service, @RequestParam(required = false) String level,
                                      @RequestParam(required = false) String correlationId, @RequestParam(required = false) String traceId, @RequestParam(required = false) String category,
                                      @RequestParam(required = false) Instant from, @RequestParam(required = false) Instant to,
                                      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size) {
        return logs.searchLogs(new LogSearchService.Filters(q, service, level, correlationId, traceId, category, from, to), page, size, false);
    }

    /** All log lines of one request across services, oldest first. */
    @GetMapping("/correlation/{correlationId}")
    public Map<String, Object> correlation(@PathVariable String correlationId, @RequestParam(defaultValue = "200") int size) {
        return logs.searchLogs(new LogSearchService.Filters(null, null, null, correlationId, null, null, null, null), 0, size, true);
    }

    @GetMapping("/overview")
    public Map<String, Object> overview(@RequestParam(defaultValue = "60") int minutes) {
        return logs.overview(Instant.now().minus(Duration.ofMinutes(Math.min(Math.max(minutes, 1), 60 * 24 * 14))));
    }

    @GetMapping("/entry/{index}/{id}")
    public JsonNode entry(@PathVariable String index, @PathVariable String id) { return logs.detail(index, id); }
}
