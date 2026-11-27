package com.fooddelivery.restaurant.service;

import com.fooddelivery.restaurant.exception.ResourceNotFoundException;
import com.fooddelivery.restaurant.model.RestaurantHours;
import com.fooddelivery.restaurant.repository.RestaurantHoursRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
public class RestaurantHoursService {

    private final RestaurantHoursRepository restaurantHoursRepository;

    public RestaurantHoursService(RestaurantHoursRepository restaurantHoursRepository) {
        this.restaurantHoursRepository = restaurantHoursRepository;
    }

    public Flux<RestaurantHours> findAll(Long restaurantId) {
        return restaurantId != null
                ? restaurantHoursRepository.findByRestaurantId(restaurantId)
                : restaurantHoursRepository.findAll();
    }

    public Mono<RestaurantHours> findById(Long id) {
        return restaurantHoursRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Restaurant hours not found: " + id)));
    }

    public Mono<RestaurantHours> create(RestaurantHours hours) {
        return restaurantHoursRepository.save(new RestaurantHours(null, hours.restaurantId(),
                hours.dayOfWeek(), hours.openTime(), hours.closeTime(), hours.isClosed()));
    }

    public Mono<RestaurantHours> update(Long id, RestaurantHours hours) {
        return findById(id)
                .map(existing -> new RestaurantHours(id, hours.restaurantId(), hours.dayOfWeek(),
                        hours.openTime(), hours.closeTime(), hours.isClosed()))
                .flatMap(restaurantHoursRepository::save);
    }

    public Mono<Void> delete(Long id) {
        return findById(id).flatMap(restaurantHoursRepository::delete);
    }
}
