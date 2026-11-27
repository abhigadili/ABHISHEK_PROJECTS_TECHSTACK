package com.fooddelivery.eventaudit.web;

import com.fooddelivery.eventaudit.monitor.HealthMonitorService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/monitoring")
@PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
@Tag(name = "Service Monitoring")
public class MonitoringController {
    private final HealthMonitorService health;

    public MonitoringController(HealthMonitorService health) { this.health = health; }

    @GetMapping("/services")
    public List<Map<String, Object>> services() { return health.overview(); }
}
