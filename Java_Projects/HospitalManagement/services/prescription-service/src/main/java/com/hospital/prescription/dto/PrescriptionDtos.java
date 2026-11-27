package com.hospital.prescription.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.hospital.prescription.domain.Prescription;
import com.hospital.prescription.domain.PrescriptionItem;
import com.hospital.prescription.domain.PrescriptionStatus;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

public final class PrescriptionDtos {
    private PrescriptionDtos() {
    }

    @Data
    public static class ItemRequest {
        @NotBlank @Size(max = 150) private String medicineName;
        @NotBlank @Size(max = 60) private String dosage;
        @NotBlank @Size(max = 80) private String frequency;
        @NotNull @Min(1) @Max(365) private Integer durationDays;
        @NotNull @Min(1) @Max(1000) private Integer quantity;
        @Size(max = 255) private String instructions;
    }

    @Data
    public static class PrescriptionRequest {
        @NotNull private Long patientId;
        @NotNull private Long doctorId;
        private Long appointmentId;
        @Size(max = 500) private String diagnosis;
        @Size(max = 1000) private String notes;
        @Min(1) @Max(365) private Integer validDays;
        @NotEmpty @Valid private List<@Valid ItemRequest> items;
    }

    @Data
    public static class CancelRequest {
        @Size(max = 255) private String reason;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ItemResponse {
        private Long id;
        private String medicineName;
        private String dosage;
        private String frequency;
        private Integer durationDays;
        private Integer quantity;
        private String instructions;

        static ItemResponse from(PrescriptionItem i) {
            return new ItemResponse(i.getId(), i.getMedicineName(), i.getDosage(), i.getFrequency(), i.getDurationDays(), i.getQuantity(), i.getInstructions());
        }
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PrescriptionResponse {
        private Long id;
        private Long patientId;
        private String patientName;
        private Long doctorId;
        private String doctorName;
        private Long appointmentId;
        private String diagnosis;
        private String notes;
        private PrescriptionStatus status;
        private LocalDate validUntil;
        private Instant issuedAt;
        private List<ItemResponse> items;

        public static PrescriptionResponse from(Prescription p) {
            return new PrescriptionResponse(p.getId(), p.getPatientId(), p.getPatientName(), p.getDoctorId(), p.getDoctorName(), p.getAppointmentId(),
                    p.getDiagnosis(), p.getNotes(), p.getStatus(), p.getValidUntil(), p.getIssuedAt(), p.getItems().stream().map(ItemResponse::from).toList());
        }
    }

    @Data
    @AllArgsConstructor
    public static class StatusResponse {
        private Long id;
        private PrescriptionStatus status;
        private Instant statusChangedAt;
    }
}
