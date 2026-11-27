package com.fooddelivery.payment.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fooddelivery.common.exception.BusinessException;
import com.fooddelivery.common.web.PageResponse;
import com.fooddelivery.payment.domain.Payment;
import com.fooddelivery.payment.domain.Refund;
import com.fooddelivery.payment.service.PaymentService;
import com.fooddelivery.payment.service.RefundService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;

@RestController
@Tag(name = "Payments & Refunds")
public class PaymentController {
    private final PaymentService payments;
    private final RefundService refunds;
    private final ObjectMapper mapper;
    private final String webhookSecret;

    public PaymentController(PaymentService payments, RefundService refunds, ObjectMapper mapper, @Value("${food.payment.webhook-secret}") String webhookSecret) {
        this.payments = payments;
        this.refunds = refunds;
        this.mapper = mapper;
        this.webhookSecret = webhookSecret;
    }

    @Operation(summary = "Pay for an order (SANDBOX provider unless configured otherwise). Idempotency-Key makes retries safe.")
    @PostMapping("/api/payments/order/{orderId}/pay")
    @PreAuthorize("hasRole('CUSTOMER')")
    public Dtos.PaymentDto pay(@PathVariable Long orderId, @Valid @RequestBody(required = false) Dtos.PayRequest r,
                               @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        return payments.pay(orderId, r, key);
    }

    @GetMapping("/api/payments/order/{orderId}")
    public Dtos.PaymentDto forOrder(@PathVariable Long orderId) { return payments.forOrder(orderId); }

    @GetMapping("/api/payments/my")
    @PreAuthorize("hasRole('CUSTOMER')")
    public List<Dtos.PaymentDto> mine() { return payments.mine(); }

    @GetMapping("/api/refunds/order/{orderId}")
    @PreAuthorize("hasAnyRole('CUSTOMER','ADMIN','SUPER_ADMIN')")
    public Dtos.RefundDto refundForOrder(@PathVariable Long orderId) {
        var r = refunds.forOrder(orderId);
        payments.forOrder(orderId);        // ownership check (customer) / admin allowed
        return r;
    }

    // ---- saved methods (token + masked value only)
    @GetMapping("/api/payments/methods")
    @PreAuthorize("hasRole('CUSTOMER')")
    public List<Dtos.SavedMethodDto> methods() { return payments.methods(); }

    @PostMapping("/api/payments/methods")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('CUSTOMER')")
    public Dtos.SavedMethodDto saveMethod(@Valid @RequestBody Dtos.SavedMethodRequest r) { return payments.saveMethod(r); }

    @DeleteMapping("/api/payments/methods/{id}")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<Void> deleteMethod(@PathVariable Long id) {
        payments.deleteMethod(id);
        return ResponseEntity.noContent().build();
    }

    /** Provider webhook: NOT protected by a JWT but by an HMAC-SHA256 signature of the raw body (header X-Signature). */
    @PostMapping("/api/payments/callback")
    public Dtos.CallbackResponse callback(@RequestBody String rawBody, @RequestHeader(value = "X-Signature", required = false) String signature) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(webhookSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String expected = HexFormat.of().formatHex(mac.doFinal(rawBody.getBytes(StandardCharsets.UTF_8)));
        if (signature == null || !MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), signature.getBytes(StandardCharsets.UTF_8))) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "BAD_SIGNATURE", "Invalid webhook signature");
        }
        return payments.callback(mapper.readValue(rawBody, Dtos.CallbackRequest.class));
    }

    // ---- admin
    @GetMapping("/api/payments")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public PageResponse<Dtos.PaymentDto> search(@RequestParam(required = false) Payment.Status status, @RequestParam(required = false) Long customerId,
                                                @RequestParam(required = false) String q, @RequestParam(defaultValue = "0") int page,
                                                @RequestParam(defaultValue = "20") int size) {
        return PageResponse.of(payments.search(status, customerId, q, page, size), p -> p);
    }

    @GetMapping("/api/payments/summary")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN','SERVICE')")
    public Dtos.Summary summary() { return payments.summary(); }

    @GetMapping("/api/refunds")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public PageResponse<Dtos.RefundDto> refunds(@RequestParam(required = false) Refund.Status status, @RequestParam(defaultValue = "0") int page,
                                                @RequestParam(defaultValue = "20") int size) {
        return PageResponse.of(refunds.list(status, page, size), r -> r);
    }

    @PostMapping("/api/refunds/{id}/retry")
    @PreAuthorize("hasAuthority('PERM_REFUND_MANAGE')")
    public Dtos.RefundDto retry(@PathVariable Long id) { return refunds.retry(id); }
}
