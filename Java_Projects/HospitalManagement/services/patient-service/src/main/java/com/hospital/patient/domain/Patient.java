package com.hospital.patient.domain;

import java.time.Instant;
import java.time.LocalDate;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Uniqueness: one profile per login (userId), and no two patients share email, phone or government identity number. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "patients",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_patient_user", columnNames = "userId"),
                @UniqueConstraint(name = "uk_patient_email", columnNames = "email"),
                @UniqueConstraint(name = "uk_patient_phone", columnNames = "phone"),
                @UniqueConstraint(name = "uk_patient_identity", columnNames = "identityNumber")},
        indexes = @Index(name = "idx_patient_name", columnList = "lastName,firstName"))
public class Patient {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    /** id of the login account in the Hospital (identity) service - a logical reference, no cross-database FK. */
    private Long userId;
    @Column(nullable = false, length = 60)
    private String firstName;
    @Column(nullable = false, length = 60)
    private String lastName;
    @Column(nullable = false)
    private LocalDate dateOfBirth;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Gender gender;
    @Column(nullable = false, length = 120)
    private String email;
    @Column(nullable = false, length = 20)
    private String phone;
    @Column(length = 40)
    private String identityNumber;
    @Column(length = 5)
    private String bloodGroup;
    @Column(length = 255)
    private String address;
    @Column(length = 100)
    private String emergencyContactName;
    @Column(length = 20)
    private String emergencyContactPhone;
    @Column(length = 500)
    private String knownAllergies;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private PatientStatus status = PatientStatus.ACTIVE;
    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
    @Column(nullable = false)
    private Instant updatedAt = Instant.now();
    @Version
    private Long version;

    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }

    public String fullName() {
        return firstName + " " + lastName;
    }
}
