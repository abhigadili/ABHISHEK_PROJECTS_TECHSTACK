package com.fooddelivery.delivery.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.ReadOnlyProperty;
import org.springframework.data.relational.core.mapping.Table;

import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Table("Delivery_Partners")
public record DeliveryPartner(

        @Id
        Long partnerId,

        @NotBlank
        String name,

        @NotBlank
        String phone,

        String email,
        String vehicleType,
        String licenseNumber,
        Boolean isAvailable,
        BigDecimal averageRating,

        @ReadOnlyProperty
        LocalDateTime createdAt
) {
}
