package com.fooddelivery.payment.controller;

import com.fooddelivery.payment.model.PaymentLog;
import com.fooddelivery.payment.service.PaymentLogService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/** Read-mostly: Payment_Logs is an append-only audit trail, so there is no update endpoint. */
@RestController
@RequestMapping("/api/payment-logs")
public class PaymentLogController {

    private final PaymentLogService paymentLogService;

    public PaymentLogController(PaymentLogService paymentLogService) {
        this.paymentLogService = paymentLogService;
    }

    @GetMapping
    public Flux<PaymentLog> findAll(@RequestParam(required = false) Long paymentId) {
        return paymentLogService.findAll(paymentId);
    }

    @GetMapping("/{id}")
    public Mono<PaymentLog> findById(@PathVariable Long id) {
        return paymentLogService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<PaymentLog> create(@Valid @RequestBody PaymentLog log) {
        return paymentLogService.create(log);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> delete(@PathVariable Long id) {
        return paymentLogService.delete(id);
    }
}
