package com.fooddelivery.payment.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.ReadOnlyProperty;
import org.springframework.data.relational.core.mapping.Table;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

@Table("Payment_Logs")
public record PaymentLog(

        @Id
        Long logId,

        @NotNull
        Long paymentId,

        @NotBlank
        String eventType,

        String message,

        @ReadOnlyProperty
        LocalDateTime loggedAt
) {
}
