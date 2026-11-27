package com.fooddelivery.delivery.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.ReadOnlyProperty;
import org.springframework.data.relational.core.mapping.Table;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Table("Delivery_Location_History")
public record DeliveryLocationHistory(

        @Id
        Long locationId,

        @NotNull
        Long deliveryId,

        @NotNull
        BigDecimal latitude,

        @NotNull
        BigDecimal longitude,

        @ReadOnlyProperty
        LocalDateTime recordedAt
) {
}
