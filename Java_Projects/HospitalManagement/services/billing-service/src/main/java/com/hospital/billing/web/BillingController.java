package com.hospital.billing.web;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.hospital.billing.domain.BillStatus;
import com.hospital.billing.dto.BillingDtos.*;
import com.hospital.billing.service.BillingService;
import com.hospital.common.web.PageResponse;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api")
public class BillingController {
    private final BillingService service;

    public BillingController(BillingService service) {
        this.service = service;
    }

    @PostMapping("/bills")
    @PreAuthorize("hasAnyRole('ADMIN','BILLING_STAFF')")
    @ResponseStatus(HttpStatus.CREATED)
    public BillResponse create(@Valid @RequestBody BillRequest r) {
        return service.createManual(r);
    }

    @GetMapping("/bills")
    @PreAuthorize("hasAnyRole('ADMIN','BILLING_STAFF')")
    public PageResponse<BillResponse> list(@RequestParam(required = false) BillStatus status,
                                           @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return PageResponse.of(service.list(status, page, size));
    }

    @GetMapping("/bills/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','BILLING_STAFF','PATIENT')")
    public BillResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    @GetMapping("/bills/patient/{patientId}")
    @PreAuthorize("hasAnyRole('ADMIN','BILLING_STAFF','PATIENT')")
    public List<BillResponse> forPatient(@PathVariable Long patientId) {
        return service.forPatient(patientId);
    }

    @PutMapping("/bills/{id}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN','BILLING_STAFF')")
    public BillResponse cancel(@PathVariable Long id) {
        return service.cancel(id);
    }

    @PostMapping("/bills/{id}/payments")
    @PreAuthorize("hasAnyRole('ADMIN','BILLING_STAFF','PATIENT')")
    @ResponseStatus(HttpStatus.CREATED)
    public PaymentResponse pay(@PathVariable Long id, @Valid @RequestBody PaymentRequest r) {
        return service.initiatePayment(id, r);
    }

    @GetMapping("/bills/{id}/payments")
    @PreAuthorize("hasAnyRole('ADMIN','BILLING_STAFF','PATIENT')")
    public List<PaymentResponse> payments(@PathVariable Long id) {
        return service.paymentsOf(id);
    }

    @GetMapping("/payments/{ref}")
    @PreAuthorize("hasAnyRole('ADMIN','BILLING_STAFF','PATIENT')")
    public PaymentResponse payment(@PathVariable String ref) {
        return service.payment(ref);
    }

    /** Simulated gateway callback / manual confirmation of cash and insurance payments. */
    @PutMapping("/payments/{ref}/status")
    @PreAuthorize("hasAnyRole('ADMIN','BILLING_STAFF')")
    public PaymentResponse updateStatus(@PathVariable String ref, @Valid @RequestBody PaymentStatusUpdate u) {
        return service.updatePaymentStatus(ref, u);
    }
}
