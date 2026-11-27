package com.fooddelivery.restaurant.controller;

import com.fooddelivery.restaurant.model.RestaurantOffer;
import com.fooddelivery.restaurant.service.RestaurantOfferService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/restaurant-offers")
public class RestaurantOfferController {

    private final RestaurantOfferService restaurantOfferService;

    public RestaurantOfferController(RestaurantOfferService restaurantOfferService) {
        this.restaurantOfferService = restaurantOfferService;
    }

    @GetMapping
    public Flux<RestaurantOffer> findAll(@RequestParam(required = false) Long restaurantId) {
        return restaurantOfferService.findAll(restaurantId);
    }

    @GetMapping("/{id}")
    public Mono<RestaurantOffer> findById(@PathVariable Long id) {
        return restaurantOfferService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<RestaurantOffer> create(@Valid @RequestBody RestaurantOffer offer) {
        return restaurantOfferService.create(offer);
    }

    @PutMapping("/{id}")
    public Mono<RestaurantOffer> update(@PathVariable Long id, @Valid @RequestBody RestaurantOffer offer) {
        return restaurantOfferService.update(id, offer);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> delete(@PathVariable Long id) {
        return restaurantOfferService.delete(id);
    }
}
