package com.fooddelivery.restaurant.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.ReadOnlyProperty;
import org.springframework.data.relational.core.mapping.Table;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Table("Menu_Items")
public record MenuItem(

        @Id
        Long menuItemId,

        @NotNull
        Long restaurantId,

        @NotNull
        Long categoryId,

        @NotBlank
        String name,

        String description,

        @NotNull
        BigDecimal price,

        Boolean isVegetarian,
        Boolean isAvailable,

        @ReadOnlyProperty
        LocalDateTime createdAt
) {
}
