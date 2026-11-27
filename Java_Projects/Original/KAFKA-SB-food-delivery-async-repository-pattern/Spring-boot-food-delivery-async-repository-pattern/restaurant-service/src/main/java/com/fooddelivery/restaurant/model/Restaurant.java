package com.fooddelivery.restaurant.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.ReadOnlyProperty;
import org.springframework.data.relational.core.mapping.Table;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Table("Restaurants")
public record Restaurant(

        @Id
        Long restaurantId,

        @NotNull
        Long categoryId,

        @NotBlank
        String name,

        String description,
        String phone,
        String email,
        String priceRange,
        BigDecimal averageRating,
        Integer totalRatings,
        Boolean isActive,

        // @ReadOnlyProperty excludes these from every INSERT/UPDATE statement
        // Spring Data R2DBC generates, so MySQL's own DEFAULT CURRENT_TIMESTAMP /
        // ON UPDATE CURRENT_TIMESTAMP clauses populate them — the app never
        // writes an explicit NULL over the DB's own default.
        @ReadOnlyProperty
        LocalDateTime createdAt,

        @ReadOnlyProperty
        LocalDateTime updatedAt
) {
}
