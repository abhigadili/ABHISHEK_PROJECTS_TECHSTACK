package com.fooddelivery.restaurant.service;

import com.fooddelivery.restaurant.exception.ResourceNotFoundException;
import com.fooddelivery.restaurant.model.RestaurantOffer;
import com.fooddelivery.restaurant.repository.RestaurantOfferRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
public class RestaurantOfferService {

    private final RestaurantOfferRepository restaurantOfferRepository;

    public RestaurantOfferService(RestaurantOfferRepository restaurantOfferRepository) {
        this.restaurantOfferRepository = restaurantOfferRepository;
    }

    public Flux<RestaurantOffer> findAll(Long restaurantId) {
        return restaurantId != null
                ? restaurantOfferRepository.findByRestaurantId(restaurantId)
                : restaurantOfferRepository.findAll();
    }

    public Mono<RestaurantOffer> findById(Long id) {
        return restaurantOfferRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Restaurant offer not found: " + id)));
    }

    public Mono<RestaurantOffer> create(RestaurantOffer offer) {
        return restaurantOfferRepository.save(new RestaurantOffer(null, offer.restaurantId(), offer.title(),
                offer.description(), offer.discountPercent(), offer.minOrderAmount(),
                offer.validFrom(), offer.validTo(), offer.isActive()));
    }

    public Mono<RestaurantOffer> update(Long id, RestaurantOffer offer) {
        return findById(id)
                .map(existing -> new RestaurantOffer(id, offer.restaurantId(), offer.title(),
                        offer.description(), offer.discountPercent(), offer.minOrderAmount(),
                        offer.validFrom(), offer.validTo(), offer.isActive()))
                .flatMap(restaurantOfferRepository::save);
    }

    public Mono<Void> delete(Long id) {
        return findById(id).flatMap(restaurantOfferRepository::delete);
    }
}
