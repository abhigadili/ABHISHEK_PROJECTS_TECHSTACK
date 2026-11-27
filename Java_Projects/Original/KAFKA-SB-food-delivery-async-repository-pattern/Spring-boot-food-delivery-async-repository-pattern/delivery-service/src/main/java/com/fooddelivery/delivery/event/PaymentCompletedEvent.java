package com.fooddelivery.delivery.event;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;

/**
 * delivery-service's own local copy of the JSON contract published by
 * payment-service to the 'payment-events' topic — see payment-service's
 * PaymentCompletedEvent for the producer side of this same shape.
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
