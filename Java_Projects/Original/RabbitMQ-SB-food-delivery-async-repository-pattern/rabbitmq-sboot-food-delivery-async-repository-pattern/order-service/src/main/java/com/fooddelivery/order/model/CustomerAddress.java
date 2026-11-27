package com.fooddelivery.order.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

@Table("Customer_Address")
public record CustomerAddress(

        @Id
        Long addressId,

        @NotNull
        Long customerId,

        String addressLine1,
        String addressLine2,
        String city,
        String state,
        String postalCode,
        String country,
        BigDecimal latitude,
        BigDecimal longitude,
        Boolean isDefault
) {
}
