package com.hospital.pharmacy.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import com.hospital.pharmacy.domain.*;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

public final class PharmacyDtos {
    private PharmacyDtos() {
    }

    @Data
    public static class MedicineRequest {
        @NotBlank @Size(max = 40) private String sku;
        @NotBlank @Size(max = 150) private String name;
        @Size(max = 150) private String genericName;
        @NotNull @DecimalMin("0.01") private BigDecimal unitPrice;
        @NotNull @Min(0) private Integer stockQuantity;
        @Min(0) private Integer reorderLevel;
    }

    @Data
    public static class RestockRequest {
        @NotNull @Min(1) private Integer quantity;
    }

    @Data
    public static class RejectRequest {
        @NotBlank @Size(max = 255) private String reason;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MedicineResponse {
        private Long id;
        private String sku;
        private String name;
        private String genericName;
        private BigDecimal unitPrice;
        private int stockQuantity;
        private int reorderLevel;
        private boolean active;

        public static MedicineResponse from(Medicine m) {
            return new MedicineResponse(m.getId(), m.getSku(), m.getName(), m.getGenericName(), m.getUnitPrice(), m.getStockQuantity(), m.getReorderLevel(), m.isActive());
        }
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OrderItemResponse {
        private String medicineName;
        private String dosage;
        private Integer quantity;
        private Long medicineId;
        private BigDecimal unitPrice;
        private boolean inStock;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OrderResponse {
        private Long id;
        private Long prescriptionId;
        private Long patientId;
        private String patientName;
        private String doctorName;
        private OrderStatus status;
        private BigDecimal totalAmount;
        private String dispensedBy;
        private Instant dispensedAt;
        private String rejectionReason;
        private Instant createdAt;
        private List<OrderItemResponse> items;

        public static OrderResponse from(PharmacyOrder o) {
            return new OrderResponse(o.getId(), o.getPrescriptionId(), o.getPatientId(), o.getPatientName(), o.getDoctorName(), o.getStatus(),
                    o.getTotalAmount(), o.getDispensedBy(), o.getDispensedAt(), o.getRejectionReason(), o.getCreatedAt(),
                    o.getItems().stream().map(i -> new OrderItemResponse(i.getMedicineName(), i.getDosage(), i.getQuantity(),
                            i.getMedicine() == null ? null : i.getMedicine().getId(), i.getUnitPrice(),
                            i.getMedicine() != null && i.getMedicine().getStockQuantity() >= i.getQuantity())).toList());
        }
    }
}
