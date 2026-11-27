package com.fooddelivery.payment.provider;

import java.math.BigDecimal;

/**
 * Payment-provider abstraction. The rest of the service only knows this interface, so a real gateway
 * (Razorpay, Stripe, ...) is a new implementation + {@code food.payment.provider=<name>}; nothing else changes.
 */
public interface PaymentProvider {
    record ChargeRequest(long orderId, String orderNumber, BigDecimal amount, String currency, String method, String token) {}
    record ChargeResult(boolean success, String providerRef, String failureReason) {}
    record RefundRequest(long orderId, String originalRef, BigDecimal amount, String scenario) {}
    record RefundResult(boolean success, String providerRef, String failureReason) {}

    String name();
    /** true when no real money moves; propagated to Payment.sandbox and shown in the API/UI. */
    boolean isSandbox();
    ChargeResult charge(ChargeRequest request);
    RefundResult refund(RefundRequest request);
}
