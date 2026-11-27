package com.hospital.laboratory.dto;

import java.math.BigDecimal;
import java.time.Instant;

import com.hospital.laboratory.domain.*;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

public final class LabDtos {
    private LabDtos() {
    }

    @Data
    public static class TestRequest {
        @NotBlank @Size(max = 30) private String code;
        @NotBlank @Size(max = 150) private String name;
        @Size(max = 60) private String sampleType;
        @NotNull @DecimalMin("0.00") private BigDecimal price;
        private Integer turnaroundHours;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TestResponse {
        private Long id;
        private String code;
        private String name;
        private String sampleType;
        private BigDecimal price;
        private Integer turnaroundHours;

        public static TestResponse from(LabTest t) {
            return new TestResponse(t.getId(), t.getCode(), t.getName(), t.getSampleType(), t.getPrice(), t.getTurnaroundHours());
        }
    }

    @Data
    public static class LabRequestCreate {
        @NotNull private Long patientId;
        @NotNull private Long doctorId;
        private Long appointmentId;
        @NotBlank private String testCode;
        private LabPriority priority;
        @Size(max = 500) private String clinicalNotes;
    }

    @Data
    public static class StatusUpdate {
        @NotNull private LabStatus status;
    }

    @Data
    public static class ReportRequest {
        @NotBlank @Size(max = 1000) private String resultSummary;
        @Size(max = 4000) private String resultDetails;
        @Size(max = 200) private String referenceRange;
        private boolean abnormal;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LabRequestResponse {
        private Long id;
        private Long patientId;
        private String patientName;
        private Long doctorId;
        private Long appointmentId;
        private String testCode;
        private String testName;
        private BigDecimal price;
        private LabPriority priority;
        private LabStatus status;
        private String clinicalNotes;
        private String accessionNumber;
        private Instant requestedAt;

        public static LabRequestResponse from(LabRequest r) {
            return new LabRequestResponse(r.getId(), r.getPatientId(), r.getPatientName(), r.getDoctorId(), r.getAppointmentId(),
                    r.getTest().getCode(), r.getTestName(), r.getPrice(), r.getPriority(), r.getStatus(), r.getClinicalNotes(),
                    r.getAccessionNumber(), r.getRequestedAt());
        }
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReportResponse {
        private Long id;
        private Long requestId;
        private Long patientId;
        private String testName;
        private String resultSummary;
        private String resultDetails;
        private String referenceRange;
        private boolean abnormal;
        private String reportedBy;
        private Instant reportedAt;

        public static ReportResponse from(LabReport r) {
            return new ReportResponse(r.getId(), r.getRequest().getId(), r.getRequest().getPatientId(), r.getRequest().getTestName(),
                    r.getResultSummary(), r.getResultDetails(), r.getReferenceRange(), r.isAbnormal(), r.getReportedBy(), r.getReportedAt());
        }
    }
}
