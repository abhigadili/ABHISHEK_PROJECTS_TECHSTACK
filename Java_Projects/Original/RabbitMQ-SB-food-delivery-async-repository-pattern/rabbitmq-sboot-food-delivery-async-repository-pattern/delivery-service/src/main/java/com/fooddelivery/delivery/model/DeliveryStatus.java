package com.fooddelivery.delivery.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.ReadOnlyProperty;
import org.springframework.data.relational.core.mapping.Table;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

@Table("Delivery_Status")
public record DeliveryStatus(

        @Id
        Long statusId,

        @NotNull
        Long deliveryId,

        @NotBlank
        String status,

        String notes,

        @ReadOnlyProperty
        LocalDateTime changedAt
) {
}
