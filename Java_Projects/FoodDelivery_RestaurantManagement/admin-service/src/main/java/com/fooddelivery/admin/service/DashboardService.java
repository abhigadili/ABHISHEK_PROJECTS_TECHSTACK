package com.fooddelivery.admin.service;

import com.fooddelivery.common.http.RemoteClient;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import io.github.resilience4j.timelimiter.annotation.TimeLimiter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Operational summary assembled from OTHER services' APIs (never their databases). All sections are fetched IN PARALLEL with
 * WebClient + Mono.zip; a section that fails degrades to {"available": false} so one sick service never blanks the dashboard.
 * Resilience4j: a TimeLimiter bounds the whole aggregation and a RateLimiter protects the fan-out.
 */
@Service
public class DashboardService {
    private static final Logger log = LoggerFactory.getLogger(DashboardService.class);
    private static final ParameterizedTypeReference<Map<String, Object>> MAP = new ParameterizedTypeReference<>() {};
    private final RemoteClient remote;

    public DashboardService(RemoteClient remote) { this.remote = remote; }

    private Mono<Map<String, Object>> section(String service, String path) {
        return remote.get(service, path, MAP)
                .onErrorResume(e -> {
                    log.warn("Dashboard section {}{} unavailable: {}", service, path, e.toString());
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("available", false);
                    m.put("reason", e.getClass().getSimpleName());
                    return Mono.just(m);
                });
    }

    @TimeLimiter(name = "admin-aggregate")
    @RateLimiter(name = "admin-aggregate")
    public CompletableFuture<Map<String, Object>> dashboard() {
        return Mono.zip(section("user-service", "/api/users/stats"), section("restaurant-service", "/api/restaurants/admin/counts"),
                        section("order-service", "/api/orders/stats"), section("payment-service", "/api/payments/summary"),
                        section("delivery-service", "/api/delivery/overview"), section("inventory-service", "/api/inventory/overview"),
                        section("notification-service", "/api/notifications/admin/stats"))
                .map(t -> {
                    Map<String, Object> out = new LinkedHashMap<>();
                    out.put("generatedAt", Instant.now().toString());
                    out.put("users", t.getT1());
                    out.put("restaurants", t.getT2());
                    out.put("orders", t.getT3());
                    out.put("payments", t.getT4());
                    out.put("delivery", t.getT5());
                    out.put("inventory", t.getT6());
                    out.put("notifications", t.getT7());
                    return out;
                }).toFuture();
    }

    /** "Needs attention" counters derived from the sections above. */
    @SuppressWarnings("unchecked")
    public Map<String, Object> attention(Map<String, Object> dash) {
        Map<String, Object> a = new LinkedHashMap<>();
        Map<String, Object> restaurants = (Map<String, Object>) dash.get("restaurants");
        Map<String, Object> delivery = (Map<String, Object>) dash.get("delivery");
        Map<String, Object> inventory = (Map<String, Object>) dash.get("inventory");
        Map<String, Object> payments = (Map<String, Object>) dash.get("payments");
        a.put("restaurantsPendingApproval", restaurants != null ? restaurants.getOrDefault("PENDING", 0) : null);
        if (delivery != null && delivery.get("deliveriesByStatus") instanceof Map<?, ?> d) a.put("unassignedDeliveries", d.get("UNASSIGNED"));
        a.put("lowStockIngredients", inventory != null ? inventory.get("lowStock") : null);
        if (payments != null && payments.get("counts") instanceof Map<?, ?> c) a.put("failedPayments", c.get("FAILED"));
        return a;
    }
}
