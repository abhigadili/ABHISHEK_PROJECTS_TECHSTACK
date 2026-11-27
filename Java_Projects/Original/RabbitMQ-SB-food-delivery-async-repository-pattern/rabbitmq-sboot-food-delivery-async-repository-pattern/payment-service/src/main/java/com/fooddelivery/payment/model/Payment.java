package com.fooddelivery.payment.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.ReadOnlyProperty;
import org.springframework.data.relational.core.mapping.Table;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Table("Payments")
public record Payment(

        @Id
        Long paymentId,

        @NotNull
        Long orderId,

        Long methodId,

        @NotNull
        BigDecimal amount,

        String currency,
        String status,
        String transactionRef,
        LocalDateTime paidAt,

        @ReadOnlyProperty
        LocalDateTime createdAt
) {
}
