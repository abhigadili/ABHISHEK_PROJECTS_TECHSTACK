package com.fooddelivery.order.event;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;

/** order-service's own local copy of the contract published by payment-service to 'payment-events'. */
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
