package com.fooddelivery.delivery.repository;

import com.fooddelivery.delivery.model.DeliveryStatus;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;

public interface DeliveryStatusRepository extends ReactiveCrudRepository<DeliveryStatus, Long> {

    Flux<DeliveryStatus> findByDeliveryId(Long deliveryId);
}
