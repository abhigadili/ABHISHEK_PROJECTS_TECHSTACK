package com.fooddelivery.delivery.repository;

import com.fooddelivery.delivery.model.DeliveryLocationHistory;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;

public interface DeliveryLocationHistoryRepository extends ReactiveCrudRepository<DeliveryLocationHistory, Long> {

    Flux<DeliveryLocationHistory> findByDeliveryId(Long deliveryId);
}
