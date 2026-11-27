package com.fooddelivery.order.controller;

import com.fooddelivery.order.model.Order;
import com.fooddelivery.order.service.OrderService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @GetMapping
    public Flux<Order> findAll(@RequestParam(required = false) Long customerId,
                                @RequestParam(required = false) Long restaurantId) {
        return orderService.findAll(customerId, restaurantId);
    }

    @GetMapping("/{id}")
    public Mono<Order> findById(@PathVariable Long id) {
        return orderService.findById(id);
    }

    /** Publishes OrderCreatedEvent asynchronously — see OrderService.create() for the full choreography this triggers. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<Order> create(@Valid @RequestBody Order order) {
        return orderService.create(order);
    }

    @PutMapping("/{id}")
    public Mono<Order> update(@PathVariable Long id, @Valid @RequestBody Order order) {
        return orderService.update(id, order);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> delete(@PathVariable Long id) {
        return orderService.delete(id);
    }
}
