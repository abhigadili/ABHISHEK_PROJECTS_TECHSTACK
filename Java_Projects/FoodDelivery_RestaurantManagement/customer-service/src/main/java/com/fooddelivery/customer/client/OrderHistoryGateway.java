package com.fooddelivery.customer.client;

import com.fooddelivery.customer.web.Dtos;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;

/** Resilience wrapper: GET is idempotent so it may be retried; when the circuit is open the profile degrades gracefully. */
@Component
public class OrderHistoryGateway {
    private static final Logger log = LoggerFactory.getLogger(OrderHistoryGateway.class);
    private final OrderClient orders;

    public OrderHistoryGateway(OrderClient orders) { this.orders = orders; }

    @CircuitBreaker(name = "order", fallbackMethod = "fallback")
    @Retry(name = "order")
    public Dtos.OrderHistory history(int page, int size) {
        return new Dtos.OrderHistory(orders.myOrders(page, size).content(), false);
    }

    Dtos.OrderHistory fallback(int page, int size, Throwable t) {
        log.warn("Order history unavailable, degrading gracefully: {}", t.toString());
        return new Dtos.OrderHistory(List.of(), true);
    }
}
