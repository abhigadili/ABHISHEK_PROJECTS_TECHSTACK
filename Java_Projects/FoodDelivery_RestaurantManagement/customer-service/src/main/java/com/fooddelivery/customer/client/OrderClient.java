package com.fooddelivery.customer.client;

import com.fooddelivery.common.web.PageResponse;
import com.fooddelivery.customer.web.Dtos;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

/** OpenFeign client (declarative HTTP, resolved through Eureka by service name). */
@FeignClient(name = "order-service", path = "/api/orders")
public interface OrderClient {
    @GetMapping("/my")
    PageResponse<Dtos.OrderSummary> myOrders(@RequestParam("page") int page, @RequestParam("size") int size);
}
