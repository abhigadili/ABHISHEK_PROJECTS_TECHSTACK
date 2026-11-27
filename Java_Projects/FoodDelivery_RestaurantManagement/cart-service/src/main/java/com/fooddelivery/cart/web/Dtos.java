package com.fooddelivery.cart.web;

import jakarta.validation.constraints.*;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public final class Dtos {
    private Dtos() {}

    public record AddItemRequest(@NotNull Long restaurantId, @NotNull Long menuItemId, @Min(1) @Max(50) int quantity,
                                 @Size(max = 40) String variant, List<Long> addOnIds, @Size(max = 300) String instructions) {}
    public record UpdateItemRequest(@Min(1) @Max(50) Integer quantity, @Size(max = 300) String instructions) {}
    public record CouponRequest(@NotBlank @Size(max = 40) String code) {}

    public record LineView(Long id, Long menuItemId, String name, String variant, ArrayList<String> addOns, int quantity, BigDecimal unitPrice,
                           BigDecimal lineTotal, String instructions, boolean vegetarian) implements Serializable {}

    /** Server-calculated cart. The frontend displays it but is never trusted to compute it. */
    public record CartView(Long restaurantId, String restaurantName, ArrayList<LineView> lines, BigDecimal subtotal, BigDecimal discount,
                           String couponCode, String couponMessage, BigDecimal deliveryFee, BigDecimal tax, BigDecimal total,
                           BigDecimal minOrderAmount, boolean minOrderSatisfied, boolean restaurantOpen, ArrayList<String> issues,
                           boolean orderable) implements Serializable {
        public static CartView empty() {
            return new CartView(null, null, new ArrayList<>(), BigDecimal.ZERO, BigDecimal.ZERO, null, null, BigDecimal.ZERO, BigDecimal.ZERO,
                    BigDecimal.ZERO, BigDecimal.ZERO, true, true, new ArrayList<>(), false);
        }
    }

    /** Raw selection (no prices) consumed by order-service. */
    public record SelectionLine(Long menuItemId, int quantity, String variant, List<Long> addOnIds, String instructions) {}
    public record Selection(Long restaurantId, String couponCode, List<SelectionLine> lines) {}
}
