package com.fooddelivery.restaurant.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import jakarta.validation.constraints.NotNull;
import java.time.LocalTime;

@Table("Restaurant_Hours")
public record RestaurantHours(

        @Id
        Long hoursId,

        @NotNull
        Long restaurantId,

        @NotNull
        Integer dayOfWeek,

        LocalTime openTime,
        LocalTime closeTime,
        Boolean isClosed
) {
}
