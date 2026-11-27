package com.fooddelivery.restaurant.repository;

import com.fooddelivery.restaurant.model.RestaurantAddress;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;

public interface RestaurantAddressRepository extends ReactiveCrudRepository<RestaurantAddress, Long> {

    Flux<RestaurantAddress> findByRestaurantId(Long restaurantId);
}
