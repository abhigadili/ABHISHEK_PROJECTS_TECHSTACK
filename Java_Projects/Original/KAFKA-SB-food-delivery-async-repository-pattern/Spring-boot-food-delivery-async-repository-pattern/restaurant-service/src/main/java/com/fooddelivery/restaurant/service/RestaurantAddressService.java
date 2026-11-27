package com.fooddelivery.restaurant.service;

import com.fooddelivery.restaurant.exception.ResourceNotFoundException;
import com.fooddelivery.restaurant.model.RestaurantAddress;
import com.fooddelivery.restaurant.repository.RestaurantAddressRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
public class RestaurantAddressService {

    private final RestaurantAddressRepository restaurantAddressRepository;

    public RestaurantAddressService(RestaurantAddressRepository restaurantAddressRepository) {
        this.restaurantAddressRepository = restaurantAddressRepository;
    }

    public Flux<RestaurantAddress> findAll(Long restaurantId) {
        return restaurantId != null
                ? restaurantAddressRepository.findByRestaurantId(restaurantId)
                : restaurantAddressRepository.findAll();
    }

    public Mono<RestaurantAddress> findById(Long id) {
        return restaurantAddressRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Restaurant address not found: " + id)));
    }

    public Mono<RestaurantAddress> create(RestaurantAddress address) {
        return restaurantAddressRepository.save(new RestaurantAddress(null, address.restaurantId(),
                address.addressLine1(), address.addressLine2(), address.city(), address.state(),
                address.postalCode(), address.country(), address.latitude(), address.longitude()));
    }

    public Mono<RestaurantAddress> update(Long id, RestaurantAddress address) {
        return findById(id)
                .map(existing -> new RestaurantAddress(id, address.restaurantId(), address.addressLine1(),
                        address.addressLine2(), address.city(), address.state(), address.postalCode(),
                        address.country(), address.latitude(), address.longitude()))
                .flatMap(restaurantAddressRepository::save);
    }

    public Mono<Void> delete(Long id) {
        return findById(id).flatMap(restaurantAddressRepository::delete);
    }
}
