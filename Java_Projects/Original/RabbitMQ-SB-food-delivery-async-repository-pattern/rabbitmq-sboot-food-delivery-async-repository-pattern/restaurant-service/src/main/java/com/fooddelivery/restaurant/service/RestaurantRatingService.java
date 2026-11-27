package com.fooddelivery.restaurant.service;

import com.fooddelivery.restaurant.exception.ResourceNotFoundException;
import com.fooddelivery.restaurant.model.RestaurantRating;
import com.fooddelivery.restaurant.repository.RestaurantRatingRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
public class RestaurantRatingService {

    private final RestaurantRatingRepository restaurantRatingRepository;

    public RestaurantRatingService(RestaurantRatingRepository restaurantRatingRepository) {
        this.restaurantRatingRepository = restaurantRatingRepository;
    }

    public Flux<RestaurantRating> findAll(Long restaurantId) {
        return restaurantId != null
                ? restaurantRatingRepository.findByRestaurantId(restaurantId)
                : restaurantRatingRepository.findAll();
    }

    public Mono<RestaurantRating> findById(Long id) {
        return restaurantRatingRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Restaurant rating not found: " + id)));
    }

    public Mono<RestaurantRating> create(RestaurantRating rating) {
        RestaurantRating toSave = new RestaurantRating(null, rating.restaurantId(),
                rating.customerId(), rating.rating(), rating.reviewText(), null);
        return restaurantRatingRepository.save(toSave)
                .flatMap(saved -> restaurantRatingRepository.findById(saved.ratingId()));
    }

    public Mono<RestaurantRating> update(Long id, RestaurantRating rating) {
        return findById(id)
                .map(existing -> new RestaurantRating(id, rating.restaurantId(), rating.customerId(),
                        rating.rating(), rating.reviewText(), existing.createdAt()))
                .flatMap(restaurantRatingRepository::save);
    }

    public Mono<Void> delete(Long id) {
        return findById(id).flatMap(restaurantRatingRepository::delete);
    }
}
