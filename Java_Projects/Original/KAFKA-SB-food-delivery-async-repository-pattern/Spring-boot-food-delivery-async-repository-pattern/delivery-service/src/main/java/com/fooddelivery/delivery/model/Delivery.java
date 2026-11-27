package com.fooddelivery.delivery.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.ReadOnlyProperty;
import org.springframework.data.relational.core.mapping.Table;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

/** order_id is a reference to OrderDB.Orders.order_id — no cross-DB FK, populated only from a Kafka event. */
@Table("Deliveries")
public record Delivery(

        @Id
        Long deliveryId,

        @NotNull
        Long orderId,

        Long partnerId,
        String pickupAddress,
        String dropAddress,
        String status,
        LocalDateTime estimatedDeliveryTime,
        LocalDateTime actualDeliveryTime,

        @ReadOnlyProperty
        LocalDateTime createdAt,

        @ReadOnlyProperty
        LocalDateTime updatedAt
) {
}
