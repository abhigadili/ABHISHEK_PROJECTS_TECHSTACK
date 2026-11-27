package com.fooddelivery.payment.provider;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * SANDBOX adapter for local development. NO real transaction happens: every reference is prefixed "SBX-" and every
 * payment created through it carries sandbox=true. Scenarios are chosen by the payment token so failure paths are testable:
 * <ul>
 *   <li>{@code tok_success} (default) - charge succeeds;</li>
 *   <li>{@code tok_fail} - charge declined ("insufficient funds");</li>
 *   <li>{@code tok_refund_fail} - charge succeeds but a later refund fails.</li>
 * </ul>
 */
@Component
public class SandboxPaymentProvider implements PaymentProvider {
    private static final Logger log = LoggerFactory.getLogger(SandboxPaymentProvider.class);

    @Override public String name() { return "SANDBOX"; }
    @Override public boolean isSandbox() { return true; }

    @Override
    public ChargeResult charge(ChargeRequest r) {
        String token = r.token() == null || r.token().isBlank() ? "tok_success" : r.token();
        log.info("[SANDBOX] charge order={} amount={} method={} (no real money moves)", r.orderNumber(), r.amount(), r.method());
        if ("tok_fail".equals(token)) return new ChargeResult(false, null, "Card declined by sandbox provider (insufficient funds)");
        return new ChargeResult(true, "SBX-" + UUID.randomUUID().toString().substring(0, 12).toUpperCase(), null);
    }

    @Override
    public RefundResult refund(RefundRequest r) {
        log.info("[SANDBOX] refund order={} amount={} of {}", r.orderId(), r.amount(), r.originalRef());
        if ("tok_refund_fail".equals(r.scenario())) return new RefundResult(false, null, "Sandbox provider rejected the refund (simulated gateway failure)");
        return new RefundResult(true, "SBX-RF-" + UUID.randomUUID().toString().substring(0, 10).toUpperCase(), null);
    }
}
