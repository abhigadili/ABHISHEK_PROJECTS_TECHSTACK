package com.hospital.doctor.dto;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import com.hospital.doctor.domain.Doctor;
import com.hospital.doctor.domain.DoctorSchedule;
import com.hospital.doctor.domain.DoctorUnavailability;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

public final class DoctorDtos {
    private DoctorDtos() {
    }

    @Data
    public static class DoctorRequest {
        @NotBlank @Size(max = 60) private String firstName;
        @NotBlank @Size(max = 60) private String lastName;
        @NotBlank @Email @Size(max = 120) private String email;
        @Pattern(regexp = "^\\+?[0-9]{7,15}$", message = "must be 7-15 digits, optional leading +") private String phone;
        @NotBlank @Size(max = 40) private String licenseNumber;
        @NotBlank @Size(max = 80) private String specialization;
        @Size(max = 150) private String qualification;
        @Min(0) @Max(70) private Integer experienceYears;
        @NotNull @DecimalMin("0.00") private BigDecimal consultationFee;
        @NotNull private Long hospitalId;
        private Long departmentId;
        /** Login account (role DOCTOR) of this doctor, created beforehand in the identity service. */
        private Long userId;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DoctorResponse {
        private Long id;
        private Long userId;
        private String fullName;
        private String firstName;
        private String lastName;
        private String email;
        private String phone;
        private String licenseNumber;
        private String specialization;
        private String qualification;
        private Integer experienceYears;
        private BigDecimal consultationFee;
        private Long hospitalId;
        private Long departmentId;
        private boolean active;

        public static DoctorResponse from(Doctor d) {
            return new DoctorResponse(d.getId(), d.getUserId(), d.fullName(), d.getFirstName(), d.getLastName(), d.getEmail(), d.getPhone(),
                    d.getLicenseNumber(), d.getSpecialization(), d.getQualification(), d.getExperienceYears(), d.getConsultationFee(),
                    d.getHospitalId(), d.getDepartmentId(), d.isActive());
        }
    }

    @Data
    public static class ScheduleEntry {
        @NotNull private DayOfWeek dayOfWeek;
        @NotNull private LocalTime startTime;
        @NotNull private LocalTime endTime;
        @NotNull @Min(5) @Max(180) private Integer slotMinutes;
        private LocalTime breakStart;
        private LocalTime breakEnd;

        public static ScheduleEntry from(DoctorSchedule s) {
            ScheduleEntry e = new ScheduleEntry();
            e.dayOfWeek = s.getDayOfWeek();
            e.startTime = s.getStartTime();
            e.endTime = s.getEndTime();
            e.slotMinutes = s.getSlotMinutes();
            e.breakStart = s.getBreakStart();
            e.breakEnd = s.getBreakEnd();
            return e;
        }
    }

    @Data
    public static class ScheduleRequest {
        @NotNull @Valid private List<@Valid ScheduleEntry> days;
    }

    @Data
    public static class UnavailabilityRequest {
        @NotNull private LocalDate date;
        @Size(max = 200) private String reason;
    }

    @Data
    @AllArgsConstructor
    public static class UnavailabilityResponse {
        private Long id;
        private LocalDate date;
        private String reason;

        public static UnavailabilityResponse from(DoctorUnavailability u) {
            return new UnavailabilityResponse(u.getId(), u.getUnavailableDate(), u.getReason());
        }
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SlotDto {
        private LocalTime startTime;
        private LocalTime endTime;
        private boolean available = true;
    }

    @Data
    @AllArgsConstructor
    public static class AvailableDoctor {
        private DoctorResponse doctor;
        private int slotCount;
        private LocalTime firstSlot;
        private LocalTime lastSlotEnd;
    }
}
