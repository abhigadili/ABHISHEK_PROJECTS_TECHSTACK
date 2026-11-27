package com.hospital.doctor.domain;

import java.math.BigDecimal;
import java.time.Instant;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "doctors",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_doctor_license", columnNames = "licenseNumber"),
                @UniqueConstraint(name = "uk_doctor_email", columnNames = "email"),
                @UniqueConstraint(name = "uk_doctor_user", columnNames = "userId")},
        indexes = {@Index(name = "idx_doctor_specialization", columnList = "specialization,active"),
                @Index(name = "idx_doctor_hospital", columnList = "hospitalId,departmentId")})
public class Doctor {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    /** Login account in the identity service (logical reference). Lets a DOCTOR manage only their own schedule. */
    private Long userId;
    @Column(nullable = false, length = 60)
    private String firstName;
    @Column(nullable = false, length = 60)
    private String lastName;
    @Column(nullable = false, length = 120)
    private String email;
    @Column(length = 20)
    private String phone;
    @Column(nullable = false, length = 40)
    private String licenseNumber;
    @Column(nullable = false, length = 80)
    private String specialization;
    @Column(length = 150)
    private String qualification;
    private Integer experienceYears;
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal consultationFee;
    /** Logical references into HospitalDB (validated through the Hospital Service, no cross-database FK). */
    @Column(nullable = false)
    private Long hospitalId;
    private Long departmentId;
    @Column(nullable = false)
    private boolean active = true;
    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public String fullName() {
        return "Dr. " + firstName + " " + lastName;
    }
}
