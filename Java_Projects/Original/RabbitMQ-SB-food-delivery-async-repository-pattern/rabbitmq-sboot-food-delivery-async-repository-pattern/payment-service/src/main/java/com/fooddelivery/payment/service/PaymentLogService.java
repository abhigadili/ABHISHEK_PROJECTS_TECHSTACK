package com.fooddelivery.payment.service;

import com.fooddelivery.payment.exception.ResourceNotFoundException;
import com.fooddelivery.payment.model.PaymentLog;
import com.fooddelivery.payment.repository.PaymentLogRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
public class PaymentLogService {

    private final PaymentLogRepository paymentLogRepository;

    public PaymentLogService(PaymentLogRepository paymentLogRepository) {
        this.paymentLogRepository = paymentLogRepository;
    }

    public Flux<PaymentLog> findAll(Long paymentId) {
        return paymentId != null ? paymentLogRepository.findByPaymentId(paymentId) : paymentLogRepository.findAll();
    }

    public Mono<PaymentLog> findById(Long id) {
        return paymentLogRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Payment log not found: " + id)));
    }

    public Mono<PaymentLog> create(PaymentLog log) {
        PaymentLog toSave = new PaymentLog(null, log.paymentId(), log.eventType(), log.message(), null);
        return paymentLogRepository.save(toSave).flatMap(saved -> paymentLogRepository.findById(saved.logId()));
    }

    public Mono<Void> delete(Long id) {
        return findById(id).flatMap(paymentLogRepository::delete);
    }
}
