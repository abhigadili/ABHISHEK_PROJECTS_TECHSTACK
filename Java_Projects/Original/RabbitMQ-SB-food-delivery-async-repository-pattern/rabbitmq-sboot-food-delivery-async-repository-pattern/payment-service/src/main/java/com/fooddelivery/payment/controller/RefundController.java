package com.fooddelivery.payment.controller;

import com.fooddelivery.payment.model.Refund;
import com.fooddelivery.payment.service.RefundService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/refunds")
public class RefundController {

    private final RefundService refundService;

    public RefundController(RefundService refundService) {
        this.refundService = refundService;
    }

    @GetMapping
    public Flux<Refund> findAll(@RequestParam(required = false) Long paymentId) {
        return refundService.findAll(paymentId);
    }

    @GetMapping("/{id}")
    public Mono<Refund> findById(@PathVariable Long id) {
        return refundService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<Refund> create(@Valid @RequestBody Refund refund) {
        return refundService.create(refund);
    }

    @PutMapping("/{id}")
    public Mono<Refund> update(@PathVariable Long id, @Valid @RequestBody Refund refund) {
        return refundService.update(id, refund);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> delete(@PathVariable Long id) {
        return refundService.delete(id);
    }
}
