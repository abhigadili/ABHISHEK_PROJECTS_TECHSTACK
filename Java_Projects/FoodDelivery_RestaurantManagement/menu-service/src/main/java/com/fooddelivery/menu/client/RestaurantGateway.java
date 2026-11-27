package com.fooddelivery.menu.client;

import com.fooddelivery.common.exception.ForbiddenException;
import com.fooddelivery.common.security.AuthUser;
import io.github.resilience4j.bulkhead.annotation.Bulkhead;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import org.springframework.stereotype.Component;

/** Ownership check against restaurant-service. Resilience4j: circuit breaker + retry (GET only) + bulkhead. No fallback: writes must fail closed. */
@Component
public class RestaurantGateway {
    private final RestaurantClient client;

    public RestaurantGateway(RestaurantClient client) { this.client = client; }

    @CircuitBreaker(name = "restaurant")
    @Retry(name = "restaurant")
    @Bulkhead(name = "restaurant")
    public RestaurantClient.RestaurantInfo info(Long restaurantId) { return client.info(restaurantId); }

    public void requireOwnerOrAdmin(Long restaurantId, AuthUser user) {
        var info = info(restaurantId);
        if (!user.isAdmin() && info.ownerUserId() != user.userId()) throw new ForbiddenException("You do not own restaurant " + restaurantId);
    }
}
