package com.fooddelivery.delivery.repository;

import com.fooddelivery.delivery.model.DeliveryPartner;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;

public interface DeliveryPartnerRepository extends ReactiveCrudRepository<DeliveryPartner, Long> {

    Flux<DeliveryPartner> findByIsAvailableTrue();
}
