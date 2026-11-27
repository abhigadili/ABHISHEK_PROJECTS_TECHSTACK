package com.fooddelivery.delivery.client;

import com.fooddelivery.common.http.RemoteClient;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Duration;

/** WebClient lookup of authoritative order data (delivery coordinates, status) from order-service. */
@Component
public class OrderInfoClient {
    public record OrderInfo(Long id, String orderNumber, String status, Long customerId, String customerName, Long restaurantId, String restaurantName,
                            Long restaurantOwnerUserId, BigDecimal totalAmount, String pickupAddress, String deliveryAddress, String deliveryCity,
                            Double deliveryLat, Double deliveryLng, String paymentMethod) {}

    private final RemoteClient remote;

    public OrderInfoClient(RemoteClient remote) { this.remote = remote; }

    /** Blocking only at this boundary: the Kafka listener thread has nothing else to do while it waits. */
    public OrderInfo info(long orderId) {
        return remote.get("order-service", "/internal/orders/{id}", OrderInfo.class, orderId).block(Duration.ofSeconds(8));
    }
}
