package com.fooddelivery.order.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.ReadOnlyProperty;
import org.springframework.data.relational.core.mapping.Table;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

@Table("Order_Status_History")
public record OrderStatusHistory(

        @Id
        Long historyId,

        @NotNull
        Long orderId,

        @NotBlank
        String status,

        String notes,

        @ReadOnlyProperty
        LocalDateTime changedAt
) {
}
