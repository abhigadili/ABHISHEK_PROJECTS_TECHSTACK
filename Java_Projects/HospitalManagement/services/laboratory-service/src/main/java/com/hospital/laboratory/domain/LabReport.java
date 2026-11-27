package com.hospital.laboratory.domain;

import java.time.Instant;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "lab_reports", uniqueConstraints = @UniqueConstraint(name = "uk_report_request", columnNames = "request_id"))
public class LabReport {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "request_id", nullable = false, foreignKey = @ForeignKey(name = "fk_report_request"))
    private LabRequest request;
    @Column(nullable = false, length = 1000)
    private String resultSummary;
    @Column(length = 4000)
    private String resultDetails;
    @Column(length = 200)
    private String referenceRange;
    @Column(nullable = false)
    private boolean abnormal;
    @Column(nullable = false, length = 60)
    private String reportedBy;
    @Column(nullable = false)
    private Instant reportedAt = Instant.now();
}
