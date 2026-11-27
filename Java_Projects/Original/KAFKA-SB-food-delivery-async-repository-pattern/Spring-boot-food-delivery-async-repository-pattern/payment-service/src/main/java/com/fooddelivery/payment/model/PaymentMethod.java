package com.fooddelivery.payment.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.ReadOnlyProperty;
import org.springframework.data.relational.core.mapping.Table;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

@Table("Payment_Methods")
public record PaymentMethod(

        @Id
        Long methodId,

        @NotNull
        Long customerId,

        @NotBlank
        String methodType,

        String provider,
        String maskedDetails,
        Boolean isDefault,

        @ReadOnlyProperty
        LocalDateTime createdAt
) {
}
