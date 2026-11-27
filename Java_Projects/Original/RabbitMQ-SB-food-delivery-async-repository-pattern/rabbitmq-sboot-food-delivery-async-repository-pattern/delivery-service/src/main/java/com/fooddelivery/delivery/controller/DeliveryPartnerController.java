package com.fooddelivery.delivery.controller;

import com.fooddelivery.delivery.model.DeliveryPartner;
import com.fooddelivery.delivery.service.DeliveryPartnerService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/delivery-partners")
public class DeliveryPartnerController {

    private final DeliveryPartnerService deliveryPartnerService;

    public DeliveryPartnerController(DeliveryPartnerService deliveryPartnerService) {
        this.deliveryPartnerService = deliveryPartnerService;
    }

    @GetMapping
    public Flux<DeliveryPartner> findAll(@RequestParam(required = false) Boolean availableOnly) {
        return deliveryPartnerService.findAll(availableOnly);
    }

    @GetMapping("/{id}")
    public Mono<DeliveryPartner> findById(@PathVariable Long id) {
        return deliveryPartnerService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<DeliveryPartner> create(@Valid @RequestBody DeliveryPartner partner) {
        return deliveryPartnerService.create(partner);
    }

    @PutMapping("/{id}")
    public Mono<DeliveryPartner> update(@PathVariable Long id, @Valid @RequestBody DeliveryPartner partner) {
        return deliveryPartnerService.update(id, partner);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> delete(@PathVariable Long id) {
        return deliveryPartnerService.delete(id);
    }
}
