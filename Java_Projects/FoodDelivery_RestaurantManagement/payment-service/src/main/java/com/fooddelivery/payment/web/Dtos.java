package com.fooddelivery.payment.web;

import com.fooddelivery.payment.domain.Payment;
import com.fooddelivery.payment.domain.Refund;
import com.fooddelivery.payment.domain.SavedMethod;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;

public final class Dtos {
    private Dtos() {}

    public record PayRequest(@Pattern(regexp = "CARD|UPI|WALLET", message = "CARD, UPI or WALLET") String method,
                             @Size(max = 80) String paymentToken, Long savedMethodId) {}
    public record SavedMethodRequest(@NotBlank @Pattern(regexp = "CARD|UPI|WALLET") String type, @NotBlank @Size(max = 60) String label,
                                     @NotBlank @Size(max = 40) String maskedValue, @NotBlank @Size(max = 80) String providerToken, boolean makeDefault) {}
    public record SavedMethodDto(Long id, String type, String label, String maskedValue, boolean defaultMethod) {
        public static SavedMethodDto from(SavedMethod m) { return new SavedMethodDto(m.getId(), m.getType(), m.getLabel(), m.getMaskedValue(), m.isDefaultMethod()); }
    }
    public record CallbackRequest(@NotBlank String providerEventId, @NotNull Long orderId, @NotBlank @Pattern(regexp = "SUCCESS|FAILED") String status,
                                  String transactionRef, String reason) {}
    public record CallbackResponse(boolean applied, boolean duplicate, String message) {}

    public record PaymentDto(Long id, Long orderId, String orderNumber, Long customerId, BigDecimal amount, String currency, String method, String status,
                             String provider, boolean sandbox, String transactionRef, String failureReason, Instant expiresAt, Instant paidAt,
                             Instant createdAt, String notice) {
        public static PaymentDto from(Payment p) {
            return new PaymentDto(p.getId(), p.getOrderId(), p.getOrderNumber(), p.getCustomerId(), p.getAmount(), p.getCurrency(), p.getMethod(),
                    p.getStatus().name(), p.getProvider(), p.isSandbox(), p.getProviderRef(), p.getFailureReason(), p.getExpiresAt(), p.getPaidAt(), p.getCreatedAt(),
                    p.isSandbox() ? "SANDBOX payment: no real money was moved" : null);
        }
    }

    public record RefundDto(Long id, Long paymentId, Long orderId, BigDecimal amount, String status, String reason, String providerRef,
                            String failureReason, int attempts, Instant createdAt, Instant completedAt) {
        public static RefundDto from(Refund r) {
            return new RefundDto(r.getId(), r.getPayment().getId(), r.getOrderId(), r.getAmount(), r.getStatus().name(), r.getReason(), r.getProviderRef(),
                    r.getFailureReason(), r.getAttempts(), r.getCreatedAt(), r.getCompletedAt());
        }
    }

    public record Summary(java.util.Map<String, Long> counts, java.util.Map<String, BigDecimal> amounts) {}
}
