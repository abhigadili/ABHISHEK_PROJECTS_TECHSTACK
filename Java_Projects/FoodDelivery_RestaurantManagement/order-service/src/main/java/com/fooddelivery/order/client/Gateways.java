package com.fooddelivery.order.client;

import com.fooddelivery.order.client.Clients.*;
import io.github.resilience4j.bulkhead.annotation.Bulkhead;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Resilience policy per dependency:
 * <ul>
 *   <li>cart selection (GET): circuit breaker + retry + bulkhead, fails fast;</li>
 *   <li>coupon validation (read-only POST): circuit breaker + retry, fails closed (order is refused, never silently un-discounted);</li>
 *   <li>inventory check (read-only POST): circuit breaker, fails OPEN with a warning (inventory is re-checked when the order is confirmed).</li>
 * </ul>
 * Order creation and payment are NEVER retried automatically.
 */
@Component
public class Gateways {
    private static final Logger log = LoggerFactory.getLogger(Gateways.class);
    private final Clients.CartClient cart;
    private final Clients.CouponClient coupons;
    private final Clients.InventoryClient inventory;

    public Gateways(Clients.CartClient cart, Clients.CouponClient coupons, Clients.InventoryClient inventory) {
        this.cart = cart;
        this.coupons = coupons;
        this.inventory = inventory;
    }

    @CircuitBreaker(name = "cart")
    @Retry(name = "cart")
    @Bulkhead(name = "restaurant")
    public Selection selection() { return cart.selection(); }

    @CircuitBreaker(name = "coupon")
    @Retry(name = "coupon")
    public CouponCheckResponse coupon(CouponCheckRequest r) { return coupons.validate(r); }

    @CircuitBreaker(name = "inventory", fallbackMethod = "inventoryFallback")
    public InvCheckResponse inventory(InvCheckRequest r) { return inventory.check(r); }

    InvCheckResponse inventoryFallback(InvCheckRequest r, Throwable t) {
        log.warn("Inventory service unavailable; skipping pre-check (will be enforced at confirmation): {}", t.toString());
        return new InvCheckResponse(true, List.of());
    }
}
