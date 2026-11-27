package com.fooddelivery.restaurant.repository;

import com.fooddelivery.restaurant.model.RestaurantRating;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;

public interface RestaurantRatingRepository extends ReactiveCrudRepository<RestaurantRating, Long> {

    Flux<RestaurantRating> findByRestaurantId(Long restaurantId);
}
