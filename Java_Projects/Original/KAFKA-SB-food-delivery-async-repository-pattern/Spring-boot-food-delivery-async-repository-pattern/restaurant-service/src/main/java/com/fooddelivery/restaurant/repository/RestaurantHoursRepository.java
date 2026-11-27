package com.fooddelivery.restaurant.repository;

import com.fooddelivery.restaurant.model.RestaurantHours;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;

public interface RestaurantHoursRepository extends ReactiveCrudRepository<RestaurantHours, Long> {

    Flux<RestaurantHours> findByRestaurantId(Long restaurantId);
}
