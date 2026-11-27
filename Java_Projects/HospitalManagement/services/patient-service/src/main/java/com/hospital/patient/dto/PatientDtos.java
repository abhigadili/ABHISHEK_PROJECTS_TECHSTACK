package com.hospital.patient.dto;

import java.time.Instant;
import java.time.LocalDate;

import com.hospital.patient.domain.Gender;
import com.hospital.patient.domain.Patient;
import com.hospital.patient.domain.PatientStatus;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

public final class PatientDtos {
    private PatientDtos() {
    }

    @Data
    public static class PatientRequest {
        @NotBlank @Size(max = 60) private String firstName;
        @NotBlank @Size(max = 60) private String lastName;
        @NotNull @Past private LocalDate dateOfBirth;
        @NotNull private Gender gender;
        @NotBlank @Email @Size(max = 120) private String email;
        @NotBlank @Pattern(regexp = "^\\+?[0-9]{7,15}$", message = "must be 7-15 digits, optional leading +") private String phone;
        @Size(max = 40) private String identityNumber;
        @Pattern(regexp = "^(A|B|AB|O)[+-]$", message = "must be A+, A-, B+, B-, AB+, AB-, O+ or O-") private String bloodGroup;
        @Size(max = 255) private String address;
        @Size(max = 100) private String emergencyContactName;
        @Pattern(regexp = "^\\+?[0-9]{7,15}$", message = "must be 7-15 digits, optional leading +") private String emergencyContactPhone;
        @Size(max = 500) private String knownAllergies;
        /** Only honoured when an ADMIN registers a patient for an existing login; PATIENT callers always use their own id. */
        private Long userId;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PatientResponse {
        private Long id;
        private Long userId;
        private String firstName;
        private String lastName;
        private LocalDate dateOfBirth;
        private Gender gender;
        private String email;
        private String phone;
        private String identityNumber;
        private String bloodGroup;
        private String address;
        private String emergencyContactName;
        private String emergencyContactPhone;
        private String knownAllergies;
        private PatientStatus status;
        private Instant createdAt;
        private Instant updatedAt;

        public static PatientResponse from(Patient p) {
            return new PatientResponse(p.getId(), p.getUserId(), p.getFirstName(), p.getLastName(), p.getDateOfBirth(),
                    p.getGender(), p.getEmail(), p.getPhone(), p.getIdentityNumber(), p.getBloodGroup(), p.getAddress(),
                    p.getEmergencyContactName(), p.getEmergencyContactPhone(), p.getKnownAllergies(), p.getStatus(),
                    p.getCreatedAt(), p.getUpdatedAt());
        }
    }
}
