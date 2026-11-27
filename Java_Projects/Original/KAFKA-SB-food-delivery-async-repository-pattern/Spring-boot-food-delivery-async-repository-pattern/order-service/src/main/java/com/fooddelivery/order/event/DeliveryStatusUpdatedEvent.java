package com.fooddelivery.order.event;

import com.fasterxml.jackson.annotation.JsonProperty;

/** order-service's own local copy of the contract published by delivery-service to 'delivery-events'. */
public record DeliveryStatusUpdatedEvent(

        @JsonProperty("orderId") Long orderId,
        @JsonProperty("deliveryId") Long deliveryId,
        @JsonProperty("status") String status,
        @JsonProperty("notes") String notes
) {
}
