package com.fooddelivery.inventory.client;

import com.fooddelivery.common.exception.ForbiddenException;
import com.fooddelivery.common.security.AuthUser;
import io.github.resilience4j.bulkhead.annotation.Bulkhead;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import org.springframework.stereotype.Component;

@Component
public class RestaurantGateway {
    private final RestaurantClient client;

    public RestaurantGateway(RestaurantClient client) { this.client = client; }

    @CircuitBreaker(name = "restaurant")
    @Retry(name = "restaurant")
    @Bulkhead(name = "restaurant")
    public RestaurantClient.RestaurantInfo info(Long restaurantId) { return client.info(restaurantId); }

    public void requireOwnerOrAdmin(Long restaurantId, AuthUser user) {
        if (user.isService()) return;
        if (!user.isAdmin() && info(restaurantId).ownerUserId() != user.userId()) throw new ForbiddenException("You do not own restaurant " + restaurantId);
    }
}
