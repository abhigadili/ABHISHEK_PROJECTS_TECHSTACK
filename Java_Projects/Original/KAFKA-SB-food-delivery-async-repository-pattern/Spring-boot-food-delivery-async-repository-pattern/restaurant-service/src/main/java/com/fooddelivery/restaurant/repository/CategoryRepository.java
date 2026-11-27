package com.fooddelivery.restaurant.repository;

import com.fooddelivery.restaurant.model.Category;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;

/**
 * Spring Data R2DBC generates the implementation at runtime — every query
 * (including derived finders) is issued through bound R2DBC statement
 * parameters, never string concatenation. Reactive: every method returns a
 * Mono/Flux that only issues the query once subscribed to.
 */
public interface CategoryRepository extends ReactiveCrudRepository<Category, Long> {
}
