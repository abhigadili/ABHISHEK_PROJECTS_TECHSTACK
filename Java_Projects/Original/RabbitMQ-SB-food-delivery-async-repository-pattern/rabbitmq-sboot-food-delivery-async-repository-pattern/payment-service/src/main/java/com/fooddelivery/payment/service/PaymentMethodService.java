package com.fooddelivery.payment.service;

import com.fooddelivery.payment.exception.ResourceNotFoundException;
import com.fooddelivery.payment.model.PaymentMethod;
import com.fooddelivery.payment.repository.PaymentMethodRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
public class PaymentMethodService {

    private final PaymentMethodRepository paymentMethodRepository;

    public PaymentMethodService(PaymentMethodRepository paymentMethodRepository) {
        this.paymentMethodRepository = paymentMethodRepository;
    }

    public Flux<PaymentMethod> findAll(Long customerId) {
        return customerId != null
                ? paymentMethodRepository.findByCustomerId(customerId)
                : paymentMethodRepository.findAll();
    }

    public Mono<PaymentMethod> findById(Long id) {
        return paymentMethodRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Payment method not found: " + id)));
    }

    public Mono<PaymentMethod> create(PaymentMethod method) {
        PaymentMethod toSave = new PaymentMethod(null, method.customerId(), method.methodType(),
                method.provider(), method.maskedDetails(), method.isDefault(), null);
        return paymentMethodRepository.save(toSave)
                .flatMap(saved -> paymentMethodRepository.findById(saved.methodId()));
    }

    public Mono<PaymentMethod> update(Long id, PaymentMethod method) {
        return findById(id)
                .map(existing -> new PaymentMethod(id, method.customerId(), method.methodType(),
                        method.provider(), method.maskedDetails(), method.isDefault(), existing.createdAt()))
                .flatMap(paymentMethodRepository::save);
    }

    public Mono<Void> delete(Long id) {
        return findById(id).flatMap(paymentMethodRepository::delete);
    }
}
