package com.fooddelivery.restaurant.repository;

import com.fooddelivery.restaurant.model.Restaurant;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;

public interface RestaurantRepository extends ReactiveCrudRepository<Restaurant, Long> {

    Flux<Restaurant> findByCategoryId(Long categoryId);

    Flux<Restaurant> findByNameContainingIgnoreCase(String search);
}
