package com.fooddelivery.payment.controller;

import com.fooddelivery.payment.model.PaymentMethod;
import com.fooddelivery.payment.service.PaymentMethodService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/payment-methods")
public class PaymentMethodController {

    private final PaymentMethodService paymentMethodService;

    public PaymentMethodController(PaymentMethodService paymentMethodService) {
        this.paymentMethodService = paymentMethodService;
    }

    @GetMapping
    public Flux<PaymentMethod> findAll(@RequestParam(required = false) Long customerId) {
        return paymentMethodService.findAll(customerId);
    }

    @GetMapping("/{id}")
    public Mono<PaymentMethod> findById(@PathVariable Long id) {
        return paymentMethodService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<PaymentMethod> create(@Valid @RequestBody PaymentMethod method) {
        return paymentMethodService.create(method);
    }

    @PutMapping("/{id}")
    public Mono<PaymentMethod> update(@PathVariable Long id, @Valid @RequestBody PaymentMethod method) {
        return paymentMethodService.update(id, method);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> delete(@PathVariable Long id) {
        return paymentMethodService.delete(id);
    }
}
