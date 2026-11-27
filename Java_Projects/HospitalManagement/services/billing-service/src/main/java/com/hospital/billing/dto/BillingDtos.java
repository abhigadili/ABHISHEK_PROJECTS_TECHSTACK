package com.hospital.billing.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.hospital.billing.domain.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

public final class BillingDtos {
    private BillingDtos() {
    }

    @Data
    public static class ItemRequest {
        @NotBlank @Size(max = 200) private String description;
        @NotNull @Min(1) private Integer quantity;
        @NotNull @DecimalMin("0.01") private BigDecimal unitPrice;
    }

    @Data
    public static class BillRequest {
        @NotNull private Long patientId;
        @NotNull private BillType billType;
        /** Optional link to the thing being billed (e.g. the appointment id for APPOINTMENT bills). */
        private Long referenceId;
        @Size(max = 255) private String note;
        @NotEmpty @Valid private List<@Valid ItemRequest> items;
    }

    @Data
    public static class PaymentRequest {
        @NotNull private PaymentMethod method;
        /** Test hook of the simulated gateway: SUCCESS / FAILURE settle immediately; omitted = stays PENDING until confirmed. */
        private Outcome simulateOutcome;
    }

    public enum Outcome { SUCCESS, FAILURE }

    @Data
    public static class PaymentStatusUpdate {
        @NotNull private PaymentStatus status;
        @Size(max = 255) private String failureReason;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ItemResponse {
        private String description;
        private Integer quantity;
        private BigDecimal unitPrice;
        private BigDecimal amount;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BillResponse {
        private Long id;
        private String billNumber;
        private Long patientId;
        private String patientName;
        private BillType billType;
        private String referenceType;
        private Long referenceId;
        private BillStatus status;
        private BigDecimal totalAmount;
        private BigDecimal paidAmount;
        private String currency;
        private LocalDate dueDate;
        private String note;
        private Instant createdAt;
        private List<ItemResponse> items;

        public static BillResponse from(Bill b) {
            return new BillResponse(b.getId(), b.getBillNumber(), b.getPatientId(), b.getPatientName(), b.getBillType(), b.getReferenceType(),
                    b.getReferenceId(), b.getStatus(), b.getTotalAmount(), b.getPaidAmount(), b.getCurrency(), b.getDueDate(), b.getNote(),
                    b.getCreatedAt(), b.getItems().stream().map(i -> new ItemResponse(i.getDescription(), i.getQuantity(), i.getUnitPrice(), i.getAmount())).toList());
        }
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PaymentResponse {
        private Long id;
        private Long billId;
        private String billNumber;
        private String transactionRef;
        private BigDecimal amount;
        private PaymentMethod method;
        private PaymentStatus status;
        private String failureReason;
        private Instant initiatedAt;
        private Instant completedAt;

        public static PaymentResponse from(Payment p) {
            return new PaymentResponse(p.getId(), p.getBill().getId(), p.getBill().getBillNumber(), p.getTransactionRef(), p.getAmount(), p.getMethod(),
                    p.getStatus(), p.getFailureReason(), p.getInitiatedAt(), p.getCompletedAt());
        }
    }
}
