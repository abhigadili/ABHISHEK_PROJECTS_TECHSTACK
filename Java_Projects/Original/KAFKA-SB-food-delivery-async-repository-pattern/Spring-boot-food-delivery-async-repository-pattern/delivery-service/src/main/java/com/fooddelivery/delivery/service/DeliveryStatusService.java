package com.fooddelivery.delivery.service;

import com.fooddelivery.delivery.exception.ResourceNotFoundException;
import com.fooddelivery.delivery.model.DeliveryStatus;
import com.fooddelivery.delivery.repository.DeliveryStatusRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
public class DeliveryStatusService {

    private final DeliveryStatusRepository deliveryStatusRepository;

    public DeliveryStatusService(DeliveryStatusRepository deliveryStatusRepository) {
        this.deliveryStatusRepository = deliveryStatusRepository;
    }

    public Flux<DeliveryStatus> findAll(Long deliveryId) {
        return deliveryId != null
                ? deliveryStatusRepository.findByDeliveryId(deliveryId)
                : deliveryStatusRepository.findAll();
    }

    public Mono<DeliveryStatus> findById(Long id) {
        return deliveryStatusRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Delivery status not found: " + id)));
    }

    public Mono<DeliveryStatus> create(DeliveryStatus status) {
        DeliveryStatus toSave = new DeliveryStatus(null, status.deliveryId(), status.status(), status.notes(), null);
        return deliveryStatusRepository.save(toSave)
                .flatMap(saved -> deliveryStatusRepository.findById(saved.statusId()));
    }

    public Mono<Void> delete(Long id) {
        return findById(id).flatMap(deliveryStatusRepository::delete);
    }
}
