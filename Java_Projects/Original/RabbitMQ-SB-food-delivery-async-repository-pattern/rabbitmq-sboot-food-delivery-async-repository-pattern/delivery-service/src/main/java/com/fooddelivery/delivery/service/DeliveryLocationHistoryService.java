package com.fooddelivery.delivery.service;

import com.fooddelivery.delivery.exception.ResourceNotFoundException;
import com.fooddelivery.delivery.model.DeliveryLocationHistory;
import com.fooddelivery.delivery.repository.DeliveryLocationHistoryRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
public class DeliveryLocationHistoryService {

    private final DeliveryLocationHistoryRepository deliveryLocationHistoryRepository;

    public DeliveryLocationHistoryService(DeliveryLocationHistoryRepository deliveryLocationHistoryRepository) {
        this.deliveryLocationHistoryRepository = deliveryLocationHistoryRepository;
    }

    public Flux<DeliveryLocationHistory> findAll(Long deliveryId) {
        return deliveryId != null
                ? deliveryLocationHistoryRepository.findByDeliveryId(deliveryId)
                : deliveryLocationHistoryRepository.findAll();
    }

    public Mono<DeliveryLocationHistory> findById(Long id) {
        return deliveryLocationHistoryRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Delivery location entry not found: " + id)));
    }

    public Mono<DeliveryLocationHistory> create(DeliveryLocationHistory location) {
        DeliveryLocationHistory toSave = new DeliveryLocationHistory(null, location.deliveryId(),
                location.latitude(), location.longitude(), null);
        return deliveryLocationHistoryRepository.save(toSave)
                .flatMap(saved -> deliveryLocationHistoryRepository.findById(saved.locationId()));
    }

    public Mono<Void> delete(Long id) {
        return findById(id).flatMap(deliveryLocationHistoryRepository::delete);
    }
}
