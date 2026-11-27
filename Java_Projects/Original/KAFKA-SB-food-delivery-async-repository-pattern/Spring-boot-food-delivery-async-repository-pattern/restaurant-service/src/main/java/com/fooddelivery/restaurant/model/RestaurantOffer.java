package com.fooddelivery.restaurant.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

@Table("Restaurant_Offers")
public record RestaurantOffer(

        @Id
        Long offerId,

        @NotNull
        Long restaurantId,

        @NotBlank
        String title,

        String description,
        BigDecimal discountPercent,
        BigDecimal minOrderAmount,
        LocalDate validFrom,
        LocalDate validTo,
        Boolean isActive
) {
}
