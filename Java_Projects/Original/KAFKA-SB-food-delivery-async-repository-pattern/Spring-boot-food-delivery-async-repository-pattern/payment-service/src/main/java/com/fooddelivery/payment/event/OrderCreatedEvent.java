package com.fooddelivery.payment.event;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;

/**
 * payment-service's own copy of the JSON contract published by order-service
 * to the 'order-events' topic. Deliberately not a shared library between
 * services — each service owns and versions its own view of an event it
 * consumes, so order-service can add fields payment-service doesn't care
 * about without forcing a lock-step deployment.
 *
 * @JsonProperty on each component guarantees correct field-name matching
 * during deserialisation regardless of whether the compiler retained
 * parameter names for this record.
 */
public record OrderCreatedEvent(

        @JsonProperty("orderId") Long orderId,
        @JsonProperty("customerId") Long customerId,
        @JsonProperty("restaurantId") Long restaurantId,
        @JsonProperty("finalAmount") BigDecimal finalAmount,
        @JsonProperty("paymentMethodId") Long paymentMethodId,
        @JsonProperty("deliveryAddressText") String deliveryAddressText
) {
}
