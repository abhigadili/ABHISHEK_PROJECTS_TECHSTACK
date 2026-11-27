package com.fooddelivery.payment.repository;

import com.fooddelivery.payment.model.PaymentMethod;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;

public interface PaymentMethodRepository extends ReactiveCrudRepository<PaymentMethod, Long> {

    Flux<PaymentMethod> findByCustomerId(Long customerId);
}
