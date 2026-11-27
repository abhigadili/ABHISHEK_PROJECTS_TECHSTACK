package com.fooddelivery.cart.client;

import io.github.resilience4j.bulkhead.annotation.Bulkhead;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/** Resilience wrappers around the Feign clients (circuit breaker + retry for GET-like lookups + bulkhead). */
@Component
public class Gateways {
    private static final Logger log = LoggerFactory.getLogger(Gateways.class);
    private final RestaurantClient restaurants;
    private final CouponClient coupons;

    public Gateways(RestaurantClient restaurants, CouponClient coupons) {
        this.restaurants = restaurants;
        this.coupons = coupons;
    }

    @CircuitBreaker(name = "restaurant")
    @Retry(name = "restaurant")
    @Bulkhead(name = "restaurant")
    public RestaurantClient.RestaurantInfo restaurant(Long id) { return restaurants.info(id); }

    /** Coupon validation is a read-only check, so it is safe to retry; on failure the cart still works without a discount. */
    @CircuitBreaker(name = "coupon", fallbackMethod = "couponFallback")
    @Retry(name = "coupon")
    public CouponClient.CheckResponse coupon(CouponClient.CheckRequest r) { return coupons.validate(r); }

    CouponClient.CheckResponse couponFallback(CouponClient.CheckRequest r, Throwable t) {
        log.warn("Coupon service unavailable, ignoring coupon for now: {}", t.toString());
        return new CouponClient.CheckResponse(false, r.code(), BigDecimal.ZERO, "Coupons are temporarily unavailable");
    }
}
