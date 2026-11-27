package com.fooddelivery.restaurant.controller;

import com.fooddelivery.restaurant.model.RestaurantRating;
import com.fooddelivery.restaurant.service.RestaurantRatingService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/restaurant-ratings")
public class RestaurantRatingController {

    private final RestaurantRatingService restaurantRatingService;

    public RestaurantRatingController(RestaurantRatingService restaurantRatingService) {
        this.restaurantRatingService = restaurantRatingService;
    }

    @GetMapping
    public Flux<RestaurantRating> findAll(@RequestParam(required = false) Long restaurantId) {
        return restaurantRatingService.findAll(restaurantId);
    }

    @GetMapping("/{id}")
    public Mono<RestaurantRating> findById(@PathVariable Long id) {
        return restaurantRatingService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<RestaurantRating> create(@Valid @RequestBody RestaurantRating rating) {
        return restaurantRatingService.create(rating);
    }

    @PutMapping("/{id}")
    public Mono<RestaurantRating> update(@PathVariable Long id, @Valid @RequestBody RestaurantRating rating) {
        return restaurantRatingService.update(id, rating);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> delete(@PathVariable Long id) {
        return restaurantRatingService.delete(id);
    }
}
