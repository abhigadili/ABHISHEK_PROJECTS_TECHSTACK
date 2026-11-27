package com.fooddelivery.order.controller;

import com.fooddelivery.order.model.OrderItem;
import com.fooddelivery.order.service.OrderItemService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/order-items")
public class OrderItemController {

    private final OrderItemService orderItemService;

    public OrderItemController(OrderItemService orderItemService) {
        this.orderItemService = orderItemService;
    }

    @GetMapping
    public Flux<OrderItem> findAll(@RequestParam(required = false) Long orderId) {
        return orderItemService.findAll(orderId);
    }

    @GetMapping("/{id}")
    public Mono<OrderItem> findById(@PathVariable Long id) {
        return orderItemService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<OrderItem> create(@Valid @RequestBody OrderItem item) {
        return orderItemService.create(item);
    }

    @PutMapping("/{id}")
    public Mono<OrderItem> update(@PathVariable Long id, @Valid @RequestBody OrderItem item) {
        return orderItemService.update(id, item);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> delete(@PathVariable Long id) {
        return orderItemService.delete(id);
    }
}
