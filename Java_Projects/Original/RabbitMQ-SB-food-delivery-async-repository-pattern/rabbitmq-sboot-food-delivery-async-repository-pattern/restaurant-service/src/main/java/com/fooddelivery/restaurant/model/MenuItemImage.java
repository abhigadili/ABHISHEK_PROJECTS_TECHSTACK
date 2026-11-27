package com.fooddelivery.restaurant.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.ReadOnlyProperty;
import org.springframework.data.relational.core.mapping.Table;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

@Table("Menu_Item_Images")
public record MenuItemImage(

        @Id
        Long imageId,

        @NotNull
        Long menuItemId,

        @NotBlank
        String imageUrl,

        Boolean isPrimary,

        @ReadOnlyProperty
        LocalDateTime uploadedAt
) {
}
