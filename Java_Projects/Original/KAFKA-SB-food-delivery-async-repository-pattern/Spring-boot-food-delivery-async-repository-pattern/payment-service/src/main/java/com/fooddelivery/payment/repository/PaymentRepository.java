package com.fooddelivery.payment.repository;

import com.fooddelivery.payment.model.Payment;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface PaymentRepository extends ReactiveCrudRepository<Payment, Long> {

    Flux<Payment> findByOrderId(Long orderId);

    Mono<Payment> findFirstByOrderIdOrderByPaymentIdDesc(Long orderId);
}
