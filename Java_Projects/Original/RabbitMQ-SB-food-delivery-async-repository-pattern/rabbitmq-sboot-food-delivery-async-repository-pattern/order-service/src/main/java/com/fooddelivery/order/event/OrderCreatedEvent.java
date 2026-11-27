package com.fooddelivery.order.event;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;

/** Published by order-service to the 'order-events' topic when a new order is placed. */
public record OrderCreatedEvent(

        @JsonProperty("orderId") Long orderId,
        @JsonProperty("customerId") Long customerId,
        @JsonProperty("restaurantId") Long restaurantId,
        @JsonProperty("finalAmount") BigDecimal finalAmount,
        @JsonProperty("paymentMethodId") Long paymentMethodId,
        @JsonProperty("deliveryAddressText") String deliveryAddressText
) {
}
