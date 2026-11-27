package com.fooddelivery.payment.service;

import com.fooddelivery.payment.exception.ResourceNotFoundException;
import com.fooddelivery.payment.model.Refund;
import com.fooddelivery.payment.repository.RefundRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
public class RefundService {

    private final RefundRepository refundRepository;

    public RefundService(RefundRepository refundRepository) {
        this.refundRepository = refundRepository;
    }

    public Flux<Refund> findAll(Long paymentId) {
        return paymentId != null ? refundRepository.findByPaymentId(paymentId) : refundRepository.findAll();
    }

    public Mono<Refund> findById(Long id) {
        return refundRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Refund not found: " + id)));
    }

    public Mono<Refund> create(Refund refund) {
        Refund toSave = new Refund(null, refund.paymentId(), refund.amount(), refund.reason(),
                refund.status() != null ? refund.status() : "PENDING", refund.processedAt(), null);
        return refundRepository.save(toSave).flatMap(saved -> refundRepository.findById(saved.refundId()));
    }

    public Mono<Refund> update(Long id, Refund refund) {
        return findById(id)
                .map(existing -> new Refund(id, refund.paymentId(), refund.amount(), refund.reason(),
                        refund.status(), refund.processedAt(), existing.createdAt()))
                .flatMap(refundRepository::save);
    }

    public Mono<Void> delete(Long id) {
        return findById(id).flatMap(refundRepository::delete);
    }
}
