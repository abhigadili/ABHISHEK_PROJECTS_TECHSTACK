package com.fooddelivery.order.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

/** menu_item_id is a reference to RestaurantDB.Menu_Items.menu_item_id — no cross-DB FK. */
@Table("Order_Items")
public record OrderItem(

        @Id
        Long orderItemId,

        @NotNull
        Long orderId,

        @NotNull
        Long menuItemId,

        @NotBlank
        String itemName,

        @NotNull
        Integer quantity,

        @NotNull
        BigDecimal unitPrice,

        @NotNull
        BigDecimal subtotal
) {
}
