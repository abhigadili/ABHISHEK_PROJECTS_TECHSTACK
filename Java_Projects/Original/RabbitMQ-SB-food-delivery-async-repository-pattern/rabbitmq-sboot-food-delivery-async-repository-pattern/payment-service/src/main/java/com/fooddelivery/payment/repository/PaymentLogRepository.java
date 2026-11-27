package com.fooddelivery.payment.repository;

import com.fooddelivery.payment.model.PaymentLog;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;

public interface PaymentLogRepository extends ReactiveCrudRepository<PaymentLog, Long> {

    Flux<PaymentLog> findByPaymentId(Long paymentId);
}
