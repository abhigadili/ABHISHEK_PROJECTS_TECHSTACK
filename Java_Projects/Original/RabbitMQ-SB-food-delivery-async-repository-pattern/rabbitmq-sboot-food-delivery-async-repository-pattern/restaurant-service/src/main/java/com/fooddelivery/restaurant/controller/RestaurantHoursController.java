package com.fooddelivery.restaurant.controller;

import com.fooddelivery.restaurant.model.RestaurantHours;
import com.fooddelivery.restaurant.service.RestaurantHoursService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/restaurant-hours")
public class RestaurantHoursController {

    private final RestaurantHoursService restaurantHoursService;

    public RestaurantHoursController(RestaurantHoursService restaurantHoursService) {
        this.restaurantHoursService = restaurantHoursService;
    }

    @GetMapping
    public Flux<RestaurantHours> findAll(@RequestParam(required = false) Long restaurantId) {
        return restaurantHoursService.findAll(restaurantId);
    }

    @GetMapping("/{id}")
    public Mono<RestaurantHours> findById(@PathVariable Long id) {
        return restaurantHoursService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<RestaurantHours> create(@Valid @RequestBody RestaurantHours hours) {
        return restaurantHoursService.create(hours);
    }

    @PutMapping("/{id}")
    public Mono<RestaurantHours> update(@PathVariable Long id, @Valid @RequestBody RestaurantHours hours) {
        return restaurantHoursService.update(id, hours);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> delete(@PathVariable Long id) {
        return restaurantHoursService.delete(id);
    }
}
