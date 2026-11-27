package com.hospital.laboratory.domain;

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
@Table(name = "lab_requests",
        uniqueConstraints = @UniqueConstraint(name = "uk_lab_accession", columnNames = "accessionNumber"),
        indexes = {@Index(name = "idx_lab_patient", columnList = "patientId,requestedAt"),
                @Index(name = "idx_lab_status", columnList = "status,priority")})
public class LabRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private Long patientId;
    @Column(nullable = false, length = 121)
    private String patientName;
    @Column(length = 120)
    private String patientEmail;
    @Column(nullable = false)
    private Long doctorId;
    private Long appointmentId;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "test_id", nullable = false, foreignKey = @ForeignKey(name = "fk_lab_request_test"))
    private LabTest test;
    @Column(nullable = false, length = 150)
    private String testName;
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private LabPriority priority = LabPriority.ROUTINE;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LabStatus status = LabStatus.REQUESTED;
    @Column(length = 500)
    private String clinicalNotes;
    @Column(length = 40)
    private String accessionNumber;
    private Instant queuedAt;
    @Column(nullable = false, updatable = false)
    private Instant requestedAt = Instant.now();
    @Column(nullable = false)
    private Instant updatedAt = Instant.now();
    @Version
    private Long version;

    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }
}
