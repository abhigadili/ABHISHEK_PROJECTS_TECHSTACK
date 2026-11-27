package com.fooddelivery.restaurant.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

@Table("Restaurant_Address")
public record RestaurantAddress(

        @Id
        Long addressId,

        @NotNull
        Long restaurantId,

        String addressLine1,
        String addressLine2,
        String city,
        String state,
        String postalCode,
        String country,
        BigDecimal latitude,
        BigDecimal longitude
) {
}
