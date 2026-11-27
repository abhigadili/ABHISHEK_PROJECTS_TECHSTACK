package com.fooddelivery.payment.controller;

import com.fooddelivery.payment.model.Payment;
import com.fooddelivery.payment.service.PaymentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @GetMapping
    public Flux<Payment> findAll(@RequestParam(required = false) Long orderId) {
        return paymentService.findAll(orderId);
    }

    @GetMapping("/{id}")
    public Mono<Payment> findById(@PathVariable Long id) {
        return paymentService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<Payment> create(@Valid @RequestBody Payment payment) {
        return paymentService.create(payment);
    }

    @PutMapping("/{id}")
    public Mono<Payment> update(@PathVariable Long id, @Valid @RequestBody Payment payment) {
        return paymentService.update(id, payment);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> delete(@PathVariable Long id) {
        return paymentService.delete(id);
    }
}
