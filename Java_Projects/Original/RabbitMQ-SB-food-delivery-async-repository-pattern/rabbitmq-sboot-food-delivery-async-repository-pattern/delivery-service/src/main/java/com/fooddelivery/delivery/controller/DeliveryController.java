package com.fooddelivery.delivery.controller;

import com.fooddelivery.delivery.model.Delivery;
import com.fooddelivery.delivery.service.DeliveryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/deliveries")
public class DeliveryController {

    private final DeliveryService deliveryService;

    public DeliveryController(DeliveryService deliveryService) {
        this.deliveryService = deliveryService;
    }

    @GetMapping
    public Flux<Delivery> findAll(@RequestParam(required = false) Long orderId,
                                   @RequestParam(required = false) Long partnerId) {
        return deliveryService.findAll(orderId, partnerId);
    }

    @GetMapping("/{id}")
    public Mono<Delivery> findById(@PathVariable Long id) {
        return deliveryService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<Delivery> create(@Valid @RequestBody Delivery delivery) {
        return deliveryService.create(delivery);
    }

    /** Setting status to DELIVERED here also frees the assigned partner for their next delivery. */
    @PutMapping("/{id}")
    public Mono<Delivery> update(@PathVariable Long id, @Valid @RequestBody Delivery delivery) {
        return deliveryService.update(id, delivery);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> delete(@PathVariable Long id) {
        return deliveryService.delete(id);
    }
}
