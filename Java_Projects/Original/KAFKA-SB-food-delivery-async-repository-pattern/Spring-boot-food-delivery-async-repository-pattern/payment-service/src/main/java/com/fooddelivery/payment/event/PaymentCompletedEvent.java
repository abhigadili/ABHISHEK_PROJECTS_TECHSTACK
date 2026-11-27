package com.fooddelivery.payment.event;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;

/**
 * Published by payment-service to the 'payment-events' topic after
 * processing an OrderCreatedEvent. Consumed by both order-service (to update
 * order status) and delivery-service (to create and assign a delivery) —
 * neither of them calls payment-service directly to find this out.
 */
public record PaymentCompletedEvent(

        @JsonProperty("orderId") Long orderId,
        @JsonProperty("paymentId") Long paymentId,
        @JsonProperty("customerId") Long customerId,
        @JsonProperty("restaurantId") Long restaurantId,
        @JsonProperty("amount") BigDecimal amount,
        @JsonProperty("status") String status,
        @JsonProperty("transactionRef") String transactionRef,
        @JsonProperty("deliveryAddressText") String deliveryAddressText
) {
}
