package com.fooddelivery.delivery.service;

import com.fooddelivery.delivery.exception.ResourceNotFoundException;
import com.fooddelivery.delivery.model.DeliveryPartner;
import com.fooddelivery.delivery.repository.DeliveryPartnerRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
public class DeliveryPartnerService {

    private final DeliveryPartnerRepository deliveryPartnerRepository;

    public DeliveryPartnerService(DeliveryPartnerRepository deliveryPartnerRepository) {
        this.deliveryPartnerRepository = deliveryPartnerRepository;
    }

    public Flux<DeliveryPartner> findAll(Boolean availableOnly) {
        return Boolean.TRUE.equals(availableOnly)
                ? deliveryPartnerRepository.findByIsAvailableTrue()
                : deliveryPartnerRepository.findAll();
    }

    public Mono<DeliveryPartner> findById(Long id) {
        return deliveryPartnerRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Delivery partner not found: " + id)));
    }

    public Mono<DeliveryPartner> create(DeliveryPartner partner) {
        DeliveryPartner toSave = new DeliveryPartner(null, partner.name(), partner.phone(), partner.email(),
                partner.vehicleType(), partner.licenseNumber(),
                partner.isAvailable() != null ? partner.isAvailable() : Boolean.TRUE,
                partner.averageRating(), null);
        return deliveryPartnerRepository.save(toSave)
                .flatMap(saved -> deliveryPartnerRepository.findById(saved.partnerId()));
    }

    public Mono<DeliveryPartner> update(Long id, DeliveryPartner partner) {
        return findById(id)
                .map(existing -> new DeliveryPartner(id, partner.name(), partner.phone(), partner.email(),
                        partner.vehicleType(), partner.licenseNumber(), partner.isAvailable(),
                        partner.averageRating(), existing.createdAt()))
                .flatMap(deliveryPartnerRepository::save);
    }

    public Mono<Void> delete(Long id) {
        return findById(id).flatMap(deliveryPartnerRepository::delete);
    }
}
