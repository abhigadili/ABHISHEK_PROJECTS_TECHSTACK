package com.fooddelivery.order.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.time.LocalDate;

@Table("Order_Coupons")
public record OrderCoupon(

        @Id
        Long couponId,

        @NotBlank
        String code,

        String description,
        BigDecimal discountPercent,
        BigDecimal discountAmount,
        BigDecimal minOrderAmount,
        LocalDate validFrom,
        LocalDate validTo,
        Integer usageLimit,
        Integer timesUsed,
        Boolean isActive
) {
}
