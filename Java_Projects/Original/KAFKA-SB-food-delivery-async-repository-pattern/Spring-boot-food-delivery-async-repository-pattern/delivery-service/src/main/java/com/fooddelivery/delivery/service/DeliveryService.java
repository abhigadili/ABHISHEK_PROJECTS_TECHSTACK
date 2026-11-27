package com.fooddelivery.delivery.service;

import com.fooddelivery.delivery.event.DeliveryEventProducer;
import com.fooddelivery.delivery.event.DeliveryStatusUpdatedEvent;
import com.fooddelivery.delivery.event.PaymentCompletedEvent;
import com.fooddelivery.delivery.exception.ResourceNotFoundException;
import com.fooddelivery.delivery.model.Delivery;
import com.fooddelivery.delivery.model.DeliveryPartner;
import com.fooddelivery.delivery.model.DeliveryStatus;
import com.fooddelivery.delivery.repository.DeliveryPartnerRepository;
import com.fooddelivery.delivery.repository.DeliveryRepository;
import com.fooddelivery.delivery.repository.DeliveryStatusRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;

@Service
public class DeliveryService {

    private static final Logger log = LoggerFactory.getLogger(DeliveryService.class);

    private final DeliveryRepository deliveryRepository;
    private final DeliveryPartnerRepository deliveryPartnerRepository;
    private final DeliveryStatusRepository deliveryStatusRepository;
    private final DeliveryEventProducer deliveryEventProducer;

    public DeliveryService(DeliveryRepository deliveryRepository,
                            DeliveryPartnerRepository deliveryPartnerRepository,
                            DeliveryStatusRepository deliveryStatusRepository,
                            DeliveryEventProducer deliveryEventProducer) {
        this.deliveryRepository = deliveryRepository;
        this.deliveryPartnerRepository = deliveryPartnerRepository;
        this.deliveryStatusRepository = deliveryStatusRepository;
        this.deliveryEventProducer = deliveryEventProducer;
    }

    public Flux<Delivery> findAll(Long orderId, Long partnerId) {
        if (orderId != null) {
            return deliveryRepository.findByOrderId(orderId);
        }
        if (partnerId != null) {
            return deliveryRepository.findByPartnerId(partnerId);
        }
        return deliveryRepository.findAll();
    }

    public Mono<Delivery> findById(Long id) {
        return deliveryRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Delivery not found: " + id)));
    }

    public Mono<Delivery> create(Delivery delivery) {
        Delivery toSave = new Delivery(null, delivery.orderId(), delivery.partnerId(), delivery.pickupAddress(),
                delivery.dropAddress(), delivery.status() != null ? delivery.status() : "PENDING",
                delivery.estimatedDeliveryTime(), delivery.actualDeliveryTime(), null, null);
        return deliveryRepository.save(toSave).flatMap(saved -> deliveryRepository.findById(saved.deliveryId()));
    }

    /**
     * If a delivery's status is updated to DELIVERED through the normal CRUD
     * endpoint, the assigned partner is freed up for their next delivery.
     */
    public Mono<Delivery> update(Long id, Delivery delivery) {
        return findById(id)
                .flatMap(existing -> {
                    Delivery updated = new Delivery(id, delivery.orderId(), delivery.partnerId(),
                            delivery.pickupAddress(), delivery.dropAddress(), delivery.status(),
                            delivery.estimatedDeliveryTime(), delivery.actualDeliveryTime(),
                            existing.createdAt(), existing.updatedAt());
                    Mono<Delivery> saveMono = deliveryRepository.save(updated);
                    if ("DELIVERED".equalsIgnoreCase(delivery.status()) && existing.partnerId() != null) {
                        return saveMono.flatMap(saved -> freePartner(existing.partnerId()).thenReturn(saved));
                    }
                    return saveMono;
                });
    }

    public Mono<Void> delete(Long id) {
        return findById(id).flatMap(deliveryRepository::delete);
    }

    /**
     * Called from the Kafka listener when a PaymentCompletedEvent arrives.
     * Only successful payments result in a delivery being created. Picks the
     * first available partner (a real system would use proximity/load), then
     * publishes DeliveryStatusUpdatedEvent so order-service can react —
     * nothing here calls order-service back directly.
     */
    public Mono<Delivery> processPaymentCompleted(PaymentCompletedEvent event) {
        if (!"SUCCESS".equalsIgnoreCase(event.status())) {
            log.info("Ignoring PaymentCompletedEvent for order {} — payment status was {}", event.orderId(), event.status());
            return Mono.empty();
        }

        return deliveryPartnerRepository.findByIsAvailableTrue()
                .next()
                .flatMap(partner -> createDeliveryWithPartner(event, partner))
                .switchIfEmpty(createDeliveryWithoutPartner(event));
    }

    private Mono<Delivery> createDeliveryWithPartner(PaymentCompletedEvent event, DeliveryPartner partner) {
        Delivery pending = new Delivery(null, event.orderId(), partner.partnerId(),
                "Restaurant #" + event.restaurantId(), event.deliveryAddressText(), "ASSIGNED",
                LocalDateTime.now().plusMinutes(45), null, null, null);

        return deliveryRepository.save(pending)
                .flatMap(saved -> seizePartner(partner)
                        .then(logStatus(saved.deliveryId(), "ASSIGNED", "Assigned to " + partner.name()))
                        .thenReturn(saved))
                .flatMap(saved -> deliveryRepository.findById(saved.deliveryId()))
                .doOnNext(saved -> deliveryEventProducer.publish(new DeliveryStatusUpdatedEvent(
                        event.orderId(), saved.deliveryId(), saved.status(), "Assigned to " + partner.name())));
    }

    private Mono<Delivery> createDeliveryWithoutPartner(PaymentCompletedEvent event) {
        log.warn("No available delivery partner for order {} — creating an unassigned delivery", event.orderId());
        Delivery pending = new Delivery(null, event.orderId(), null, "Restaurant #" + event.restaurantId(),
                event.deliveryAddressText(), "PENDING", null, null, null, null);

        return deliveryRepository.save(pending)
                .flatMap(saved -> logStatus(saved.deliveryId(), "PENDING", "No delivery partner available").thenReturn(saved))
                .flatMap(saved -> deliveryRepository.findById(saved.deliveryId()))
                .doOnNext(saved -> deliveryEventProducer.publish(new DeliveryStatusUpdatedEvent(
                        event.orderId(), saved.deliveryId(), saved.status(), "No delivery partner available")));
    }

    private Mono<DeliveryStatus> logStatus(Long deliveryId, String status, String notes) {
        return deliveryStatusRepository.save(new DeliveryStatus(null, deliveryId, status, notes, null));
    }

    private Mono<DeliveryPartner> seizePartner(DeliveryPartner partner) {
        DeliveryPartner updated = new DeliveryPartner(partner.partnerId(), partner.name(), partner.phone(),
                partner.email(), partner.vehicleType(), partner.licenseNumber(), false,
                partner.averageRating(), partner.createdAt());
        return deliveryPartnerRepository.save(updated);
    }

    private Mono<DeliveryPartner> freePartner(Long partnerId) {
        return deliveryPartnerRepository.findById(partnerId)
                .flatMap(partner -> {
                    DeliveryPartner updated = new DeliveryPartner(partner.partnerId(), partner.name(), partner.phone(),
                            partner.email(), partner.vehicleType(), partner.licenseNumber(), true,
                            partner.averageRating(), partner.createdAt());
                    return deliveryPartnerRepository.save(updated);
                });
    }
}
