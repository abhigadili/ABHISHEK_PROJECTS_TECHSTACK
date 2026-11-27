package com.fooddelivery.restaurant.repository;

import com.fooddelivery.restaurant.model.RestaurantOffer;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;

public interface RestaurantOfferRepository extends ReactiveCrudRepository<RestaurantOffer, Long> {

    Flux<RestaurantOffer> findByRestaurantId(Long restaurantId);
}
