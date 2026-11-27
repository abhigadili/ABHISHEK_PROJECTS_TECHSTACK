package com.fooddelivery.payment.client;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import org.springframework.stereotype.Component;

/** Reading an order is idempotent, so it may be retried; the circuit breaker stops hammering a failing order-service. */
@Component
public class OrderGateway {
    private final OrderClient client;

    public OrderGateway(OrderClient client) { this.client = client; }

    @CircuitBreaker(name = "order")
    @Retry(name = "order")
    public OrderClient.OrderInfo info(Long id) { return client.info(id); }
}
