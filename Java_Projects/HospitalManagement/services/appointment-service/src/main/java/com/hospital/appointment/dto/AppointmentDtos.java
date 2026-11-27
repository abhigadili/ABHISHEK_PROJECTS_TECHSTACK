package com.hospital.appointment.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

import com.hospital.appointment.domain.Appointment;
import com.hospital.appointment.domain.AppointmentStatus;
import com.hospital.appointment.domain.PaymentStatus;

import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

public final class AppointmentDtos {
    private AppointmentDtos() {
    }

    @Data
    public static class BookRequest {
        @NotNull private Long patientId;
        @NotNull private Long doctorId;
        @NotNull @FutureOrPresent private LocalDate date;
        @NotNull private LocalTime startTime;
        @Size(max = 255) private String reason;
    }

    @Data
    public static class RescheduleRequest {
        @NotNull @FutureOrPresent private LocalDate date;
        @NotNull private LocalTime startTime;
    }

    @Data
    public static class CancelRequest {
        @Size(max = 255) private String reason;
    }

    @Data
    public static class CompleteRequest {
        @Size(max = 1000) private String notes;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AppointmentResponse {
        private Long id;
        private Long patientId;
        private String patientName;
        private Long doctorId;
        private String doctorName;
        private LocalDate date;
        private LocalTime startTime;
        private LocalTime endTime;
        private AppointmentStatus status;
        private String reason;
        private String cancelReason;
        private String notes;
        private BigDecimal fee;
        private PaymentStatus paymentStatus;
        private String billNumber;
        private Instant createdAt;

        public static AppointmentResponse from(Appointment a) {
            return new AppointmentResponse(a.getId(), a.getPatientId(), a.getPatientName(), a.getDoctorId(), a.getDoctorName(),
                    a.getAppointmentDate(), a.getStartTime(), a.getEndTime(), a.getStatus(), a.getReason(), a.getCancelReason(),
                    a.getNotes(), a.getFee(), a.getPaymentStatus(), a.getBillNumber(), a.getCreatedAt());
        }
    }
}
