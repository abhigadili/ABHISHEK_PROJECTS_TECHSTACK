package com.fooddelivery.order.controller;

import com.fooddelivery.order.model.OrderStatusHistory;
import com.fooddelivery.order.service.OrderStatusHistoryService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/** Read-only: rows are written internally by OrderService as it reacts to RabbitMQ events, not via a public create endpoint. */
@RestController
@RequestMapping("/api/order-status-history")
public class OrderStatusHistoryController {

    private final OrderStatusHistoryService orderStatusHistoryService;

    public OrderStatusHistoryController(OrderStatusHistoryService orderStatusHistoryService) {
        this.orderStatusHistoryService = orderStatusHistoryService;
    }

    @GetMapping
    public Flux<OrderStatusHistory> findAll(@RequestParam(required = false) Long orderId) {
        return orderStatusHistoryService.findAll(orderId);
    }

    @GetMapping("/{id}")
    public Mono<OrderStatusHistory> findById(@PathVariable Long id) {
        return orderStatusHistoryService.findById(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> delete(@PathVariable Long id) {
        return orderStatusHistoryService.delete(id);
    }
}
