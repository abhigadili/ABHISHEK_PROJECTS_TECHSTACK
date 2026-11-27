package com.fooddelivery.restaurant.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.ReadOnlyProperty;
import org.springframework.data.relational.core.mapping.Table;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

@Table("Restaurant_Ratings")
public record RestaurantRating(

        @Id
        Long ratingId,

        @NotNull
        Long restaurantId,

        @NotNull
        Long customerId,

        @NotNull
        Integer rating,

        String reviewText,

        @ReadOnlyProperty
        LocalDateTime createdAt
) {
}
