package com.fooddelivery.cart.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.math.BigDecimal;

@FeignClient(name = "coupon-service")
public interface CouponClient {
    record CheckRequest(String code, Long customerId, Long restaurantId, BigDecimal subtotal) {}
    record CheckResponse(boolean valid, String code, BigDecimal discountAmount, String message) {}

    @PostMapping("/internal/coupons/validate")
    CheckResponse validate(@RequestBody CheckRequest request);
}
