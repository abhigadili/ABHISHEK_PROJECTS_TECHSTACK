package com.fooddelivery.payment.repository;

import com.fooddelivery.payment.model.Refund;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;

public interface RefundRepository extends ReactiveCrudRepository<Refund, Long> {

    Flux<Refund> findByPaymentId(Long paymentId);
}
