package com.fooddelivery.payment.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.ReadOnlyProperty;
import org.springframework.data.relational.core.mapping.Table;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Table("Refunds")
public record Refund(

        @Id
        Long refundId,

        @NotNull
        Long paymentId,

        @NotNull
        BigDecimal amount,

        String reason,
        String status,
        LocalDateTime processedAt,

        @ReadOnlyProperty
        LocalDateTime createdAt
) {
}
