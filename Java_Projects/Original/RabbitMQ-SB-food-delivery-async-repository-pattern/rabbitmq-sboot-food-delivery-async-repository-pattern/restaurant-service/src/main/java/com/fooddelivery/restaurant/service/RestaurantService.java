package com.fooddelivery.restaurant.service;

import com.fooddelivery.restaurant.exception.ResourceNotFoundException;
import com.fooddelivery.restaurant.model.Restaurant;
import com.fooddelivery.restaurant.repository.RestaurantRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
public class RestaurantService {

    private final RestaurantRepository restaurantRepository;

    public RestaurantService(RestaurantRepository restaurantRepository) {
        this.restaurantRepository = restaurantRepository;
    }

    public Flux<Restaurant> findAll(Long categoryId, String search) {
        if (categoryId != null) {
            return restaurantRepository.findByCategoryId(categoryId);
        }
        if (search != null && !search.isBlank()) {
            return restaurantRepository.findByNameContainingIgnoreCase(search);
        }
        return restaurantRepository.findAll();
    }

    public Mono<Restaurant> findById(Long id) {
        return restaurantRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Restaurant not found: " + id)));
    }

    public Mono<Restaurant> create(Restaurant restaurant) {
        Restaurant toSave = new Restaurant(null, restaurant.categoryId(), restaurant.name(),
                restaurant.description(), restaurant.phone(), restaurant.email(),
                restaurant.priceRange() != null ? restaurant.priceRange() : "$$",
                restaurant.averageRating() != null ? restaurant.averageRating() : java.math.BigDecimal.ZERO,
                restaurant.totalRatings() != null ? restaurant.totalRatings() : 0,
                restaurant.isActive() != null ? restaurant.isActive() : Boolean.TRUE,
                null, null);
        // save() for a new row only returns the generated id merged into the
        // object we passed in — it does not re-read MySQL's own
        // DEFAULT CURRENT_TIMESTAMP values for createdAt/updatedAt. Re-fetch
        // so the response accurately reflects what's actually in the database.
        return restaurantRepository.save(toSave)
                .flatMap(saved -> restaurantRepository.findById(saved.restaurantId()));
    }

    public Mono<Restaurant> update(Long id, Restaurant restaurant) {
        return findById(id)
                .map(existing -> new Restaurant(id, restaurant.categoryId(), restaurant.name(),
                        restaurant.description(), restaurant.phone(), restaurant.email(),
                        restaurant.priceRange(), existing.averageRating(), existing.totalRatings(),
                        restaurant.isActive(), existing.createdAt(), existing.updatedAt()))
                .flatMap(restaurantRepository::save);
    }

    public Mono<Void> delete(Long id) {
        return findById(id).flatMap(restaurantRepository::delete);
    }
}
