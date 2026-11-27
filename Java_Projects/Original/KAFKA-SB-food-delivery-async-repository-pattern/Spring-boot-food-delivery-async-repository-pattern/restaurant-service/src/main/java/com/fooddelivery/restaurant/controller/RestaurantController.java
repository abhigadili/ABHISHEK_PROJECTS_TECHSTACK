package com.fooddelivery.restaurant.controller;

import com.fooddelivery.restaurant.model.Restaurant;
import com.fooddelivery.restaurant.service.RestaurantService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/restaurants")
public class RestaurantController {

    private final RestaurantService restaurantService;

    public RestaurantController(RestaurantService restaurantService) {
        this.restaurantService = restaurantService;
    }

    @GetMapping
    public Flux<Restaurant> findAll(@RequestParam(required = false) Long categoryId,
                                     @RequestParam(required = false) String search) {
        return restaurantService.findAll(categoryId, search);
    }

    @GetMapping("/{id}")
    public Mono<Restaurant> findById(@PathVariable Long id) {
        return restaurantService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<Restaurant> create(@Valid @RequestBody Restaurant restaurant) {
        return restaurantService.create(restaurant);
    }

    @PutMapping("/{id}")
    public Mono<Restaurant> update(@PathVariable Long id, @Valid @RequestBody Restaurant restaurant) {
        return restaurantService.update(id, restaurant);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> delete(@PathVariable Long id) {
        return restaurantService.delete(id);
    }
}
