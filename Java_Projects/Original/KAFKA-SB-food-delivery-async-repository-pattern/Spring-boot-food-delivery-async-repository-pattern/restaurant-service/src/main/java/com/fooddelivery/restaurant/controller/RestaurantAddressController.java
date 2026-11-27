package com.fooddelivery.restaurant.controller;

import com.fooddelivery.restaurant.model.RestaurantAddress;
import com.fooddelivery.restaurant.service.RestaurantAddressService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/restaurant-addresses")
public class RestaurantAddressController {

    private final RestaurantAddressService restaurantAddressService;

    public RestaurantAddressController(RestaurantAddressService restaurantAddressService) {
        this.restaurantAddressService = restaurantAddressService;
    }

    @GetMapping
    public Flux<RestaurantAddress> findAll(@RequestParam(required = false) Long restaurantId) {
        return restaurantAddressService.findAll(restaurantId);
    }

    @GetMapping("/{id}")
    public Mono<RestaurantAddress> findById(@PathVariable Long id) {
        return restaurantAddressService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<RestaurantAddress> create(@Valid @RequestBody RestaurantAddress address) {
        return restaurantAddressService.create(address);
    }

    @PutMapping("/{id}")
    public Mono<RestaurantAddress> update(@PathVariable Long id, @Valid @RequestBody RestaurantAddress address) {
        return restaurantAddressService.update(id, address);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> delete(@PathVariable Long id) {
        return restaurantAddressService.delete(id);
    }
}
