package com.hospital.records.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import com.hospital.records.domain.EntryType;
import com.hospital.records.domain.PatientRecord;
import com.hospital.records.domain.RecordEntry;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

public final class RecordDtos {
    private RecordDtos() {
    }

    @Data
    public static class EntryRequest {
        @NotNull private Long patientId;
        @NotNull private EntryType entryType;
        @NotBlank @Size(max = 200) private String title;
        @Size(max = 4000) private String details;
        private Long doctorId;
    }

    @Data
    public static class EntryUpdateRequest {
        @NotBlank @Size(max = 200) private String title;
        @Size(max = 4000) private String details;
    }

    @Data
    public static class ConditionsRequest {
        @Size(max = 500) private String chronicConditions;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EntryResponse {
        private Long id;
        private Long patientId;
        private EntryType entryType;
        private String title;
        private String details;
        private Long doctorId;
        private String referenceType;
        private Long referenceId;
        private String source;
        private Instant recordedAt;

        public static EntryResponse from(RecordEntry e) {
            return new EntryResponse(e.getId(), e.getPatientId(), e.getEntryType(), e.getTitle(), e.getDetails(), e.getDoctorId(),
                    e.getReferenceType(), e.getReferenceId(), e.getSource(), e.getRecordedAt());
        }
    }

    @Data
    @AllArgsConstructor
    public static class SummaryResponse {
        private Long patientId;
        private String patientName;
        private String chronicConditions;
        private Map<EntryType, Long> entryCounts;
        private List<EntryResponse> latestEntries;

        public static SummaryResponse of(PatientRecord r, Map<EntryType, Long> counts, List<EntryResponse> latest) {
            return new SummaryResponse(r.getPatientId(), r.getPatientName(), r.getChronicConditions(), counts, latest);
        }
    }
}
