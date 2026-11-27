package com.fooddelivery.delivery.controller;

import com.fooddelivery.delivery.model.DeliveryLocationHistory;
import com.fooddelivery.delivery.service.DeliveryLocationHistoryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/** Read-mostly: GPS pings are append-only, so there is no update endpoint. */
@RestController
@RequestMapping("/api/delivery-locations")
public class DeliveryLocationHistoryController {

    private final DeliveryLocationHistoryService deliveryLocationHistoryService;

    public DeliveryLocationHistoryController(DeliveryLocationHistoryService deliveryLocationHistoryService) {
        this.deliveryLocationHistoryService = deliveryLocationHistoryService;
    }

    @GetMapping
    public Flux<DeliveryLocationHistory> findAll(@RequestParam(required = false) Long deliveryId) {
        return deliveryLocationHistoryService.findAll(deliveryId);
    }

    @GetMapping("/{id}")
    public Mono<DeliveryLocationHistory> findById(@PathVariable Long id) {
        return deliveryLocationHistoryService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<DeliveryLocationHistory> create(@Valid @RequestBody DeliveryLocationHistory location) {
        return deliveryLocationHistoryService.create(location);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> delete(@PathVariable Long id) {
        return deliveryLocationHistoryService.delete(id);
    }
}
