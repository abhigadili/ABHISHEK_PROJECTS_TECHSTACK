package com.fooddelivery.order.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.ReadOnlyProperty;
import org.springframework.data.relational.core.mapping.Table;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * restaurant_id is a reference to RestaurantDB.Restaurants.restaurant_id —
 * no cross-DB FK, and (per this system's asynchronous-only rule) never
 * validated with a synchronous call either. order-service trusts the id it's
 * given; nothing downstream depends on that trust being correct to function.
 */
@Table("Orders")
public record Order(

        @Id
        Long orderId,

        @NotNull
        Long customerId,

        @NotNull
        Long restaurantId,

        @NotNull
        Long deliveryAddressId,

        Long couponId,
        String orderStatus,

        @NotNull
        BigDecimal totalAmount,

        BigDecimal discountAmount,
        BigDecimal deliveryFee,

        @NotNull
        BigDecimal finalAmount,

        @ReadOnlyProperty
        LocalDateTime placedAt,

        @ReadOnlyProperty
        LocalDateTime updatedAt
) {
}
