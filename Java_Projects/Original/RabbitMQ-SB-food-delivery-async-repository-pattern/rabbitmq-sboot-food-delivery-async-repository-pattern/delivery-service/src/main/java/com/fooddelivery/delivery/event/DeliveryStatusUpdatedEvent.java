package com.fooddelivery.delivery.event;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Published by delivery-service to the 'delivery-events' topic. Consumed by order-service to update order status/history. */
public record DeliveryStatusUpdatedEvent(

        @JsonProperty("orderId") Long orderId,
        @JsonProperty("deliveryId") Long deliveryId,
        @JsonProperty("status") String status,
        @JsonProperty("notes") String notes
) {
}
