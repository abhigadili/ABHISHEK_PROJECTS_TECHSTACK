package com.fooddelivery.inventory.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.math.BigDecimal;

@FeignClient(name = "restaurant-service")
public interface RestaurantClient {
    record RestaurantInfo(Long id, Long ownerUserId, String name, String status, boolean openNow, String addressLine, String city,
                          BigDecimal deliveryFee, BigDecimal minOrderAmount, int prepTimeMinutes) {}

    @GetMapping("/internal/restaurants/{id}")
    RestaurantInfo info(@PathVariable("id") Long id);
}
