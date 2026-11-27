package com.fooddelivery.delivery.controller;

import com.fooddelivery.delivery.model.DeliveryStatus;
import com.fooddelivery.delivery.service.DeliveryStatusService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/** Read-mostly: Delivery_Status is an append-only trail, so there is no update endpoint. */
@RestController
@RequestMapping("/api/delivery-statuses")
public class DeliveryStatusController {

    private final DeliveryStatusService deliveryStatusService;

    public DeliveryStatusController(DeliveryStatusService deliveryStatusService) {
        this.deliveryStatusService = deliveryStatusService;
    }

    @GetMapping
    public Flux<DeliveryStatus> findAll(@RequestParam(required = false) Long deliveryId) {
        return deliveryStatusService.findAll(deliveryId);
    }

    @GetMapping("/{id}")
    public Mono<DeliveryStatus> findById(@PathVariable Long id) {
        return deliveryStatusService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<DeliveryStatus> create(@Valid @RequestBody DeliveryStatus status) {
        return deliveryStatusService.create(status);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> delete(@PathVariable Long id) {
        return deliveryStatusService.delete(id);
    }
}
