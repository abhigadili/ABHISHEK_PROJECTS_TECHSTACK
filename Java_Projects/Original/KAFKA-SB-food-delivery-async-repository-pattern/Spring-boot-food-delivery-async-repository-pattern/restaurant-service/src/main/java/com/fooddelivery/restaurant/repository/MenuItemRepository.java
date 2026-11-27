package com.fooddelivery.restaurant.repository;

import com.fooddelivery.restaurant.model.MenuItem;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;

public interface MenuItemRepository extends ReactiveCrudRepository<MenuItem, Long> {

    Flux<MenuItem> findByRestaurantId(Long restaurantId);

    Flux<MenuItem> findByCategoryId(Long categoryId);
}
