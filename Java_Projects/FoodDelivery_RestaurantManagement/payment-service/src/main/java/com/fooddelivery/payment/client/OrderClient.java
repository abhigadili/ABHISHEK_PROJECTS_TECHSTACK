package com.fooddelivery.payment.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.math.BigDecimal;

@FeignClient(name = "order-service")
public interface OrderClient {
    record OrderInfo(Long id, String orderNumber, String status, Long customerId, String customerName, Long restaurantId, String restaurantName,
                     Long restaurantOwnerUserId, BigDecimal totalAmount, String pickupAddress, String deliveryAddress, String deliveryCity,
                     Double deliveryLat, Double deliveryLng, String paymentMethod) {}

    @GetMapping("/internal/orders/{id}")
    OrderInfo info(@PathVariable("id") Long id);
}
