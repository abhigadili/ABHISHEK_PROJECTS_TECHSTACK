package com.hospital.records.domain;

import java.time.Instant;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Per-patient clinical file header, created automatically from the PatientRegistered event. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "patient_records", uniqueConstraints = @UniqueConstraint(name = "uk_record_patient", columnNames = "patientId"))
public class PatientRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private Long patientId;
    @Column(nullable = false, length = 121)
    private String patientName;
    @Column(length = 500)
    private String chronicConditions;
    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }
}
