package com.studentmgmt.enrollment.controller;

import com.studentmgmt.enrollment.entity.Payment;
import com.studentmgmt.enrollment.service.PaymentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @GetMapping
    public List<Payment> findAll(@RequestParam(required = false) Long enrollmentId) {
        return paymentService.findAll(enrollmentId);
    }

    @GetMapping("/{id}")
    public Payment findById(@PathVariable Long id) {
        return paymentService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Payment create(@Valid @RequestBody Payment payment) {
        return paymentService.create(payment);
    }

    @PutMapping("/{id}/mark-success")
    public Payment markSuccess(@PathVariable Long id) {
        return paymentService.markSuccess(id);
    }
}
