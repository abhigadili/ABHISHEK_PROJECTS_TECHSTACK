package com.fooddelivery.gateway;

import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Route table: path prefix -> Eureka service id ("lb://", client-side load balancing). Every route is wrapped in a
 * Resilience4j circuit breaker whose fallback is /fallback/{service}.
 */
@Configuration
public class RouteConfig {

    private record R(String id, String service, String... paths) {}

    @Bean
    public RouteLocator routes(RouteLocatorBuilder b) {
        RouteLocatorBuilder.Builder routes = b.routes();
        R[] table = {
            new R("user", "user-service", "/api/auth/**", "/api/users/**"),
            new R("customer", "customer-service", "/api/customers/**"),
            new R("restaurant", "restaurant-service", "/api/restaurants/**", "/api/files/**"),
            new R("menu", "menu-service", "/api/menu/**"),
            new R("cart", "cart-service", "/api/cart/**"),
            new R("order", "order-service", "/api/orders/**"),
            new R("payment", "payment-service", "/api/payments/**", "/api/refunds/**"),
            new R("delivery", "delivery-service", "/api/delivery/**"),
            new R("notification", "notification-service", "/api/notifications/**"),
            new R("review", "review-service", "/api/reviews/**"),
            new R("coupon", "coupon-service", "/api/coupons/**"),
            new R("inventory", "inventory-service", "/api/inventory/**"),
            new R("search", "search-service", "/api/search/**"),
            new R("admin", "admin-service", "/api/admin/**"),
            new R("event-audit", "event-audit-service", "/api/kafka/**", "/api/audit/**", "/api/logs/**", "/api/monitoring/**"),
        };
        for (R r : table) {
            routes.route(r.id(), p -> p.path(r.paths())
                    .filters(f -> f.circuitBreaker(c -> c.setName(r.id()).setFallbackUri("forward:/fallback/" + r.id())))
                    .uri("lb://" + r.service()));
            // Gateway-level API documentation entry point: /docs/<id>/v3/api-docs -> that service's OpenAPI JSON
            routes.route("docs-" + r.id(), p -> p.path("/docs/" + r.id() + "/v3/api-docs")
                    .filters(f -> f.rewritePath("/docs/" + r.id() + "/v3/api-docs", "/v3/api-docs"))
                    .uri("lb://" + r.service()));
        }
        return routes.build();
    }
}
