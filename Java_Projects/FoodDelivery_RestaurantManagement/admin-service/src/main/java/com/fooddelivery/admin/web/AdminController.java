package com.fooddelivery.admin.web;

import com.fooddelivery.admin.domain.ActivityEntry;
import com.fooddelivery.admin.domain.SystemConfig;
import com.fooddelivery.admin.service.AdminService;
import com.fooddelivery.admin.service.DashboardService;
import com.fooddelivery.common.web.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
@Tag(name = "Admin")
public class AdminController {
    public record ConfigRequest(@NotNull @Size(max = 500) String value) {}

    private final DashboardService dashboard;
    private final AdminService admin;

    public AdminController(DashboardService dashboard, AdminService admin) {
        this.dashboard = dashboard;
        this.admin = admin;
    }

    @Operation(summary = "Platform dashboard assembled in parallel from user, restaurant, order, payment, delivery, inventory and notification services")
    @GetMapping("/dashboard")
    public CompletableFuture<Map<String, Object>> dashboard() {
        return dashboard.dashboard().thenApply(d -> {
            d.put("attention", dashboard.attention(d));
            return d;
        });
    }

    @GetMapping("/activity")
    public PageResponse<ActivityEntry> activity(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
        return PageResponse.of(admin.feed(page, size), a -> a);
    }

    @GetMapping("/config")
    public List<SystemConfig> config() { return admin.allConfig(); }

    @PutMapping("/config/{key}")
    @PreAuthorize("hasAuthority('PERM_SYSTEM_CONFIG')")
    public SystemConfig setConfig(@PathVariable String key, @Valid @RequestBody ConfigRequest r) { return admin.setConfig(key, r.value()); }
}
