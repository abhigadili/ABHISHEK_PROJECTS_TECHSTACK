package com.fooddelivery.delivery.repository;

import com.fooddelivery.delivery.model.Delivery;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface DeliveryRepository extends ReactiveCrudRepository<Delivery, Long> {

    Flux<Delivery> findByOrderId(Long orderId);

    Mono<Delivery> findFirstByOrderIdOrderByDeliveryIdDesc(Long orderId);

    Flux<Delivery> findByPartnerId(Long partnerId);
}
