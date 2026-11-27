package com.hospital.prescription.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "prescriptions", indexes = {
        @Index(name = "idx_rx_patient", columnList = "patientId,issuedAt"),
        @Index(name = "idx_rx_status_valid", columnList = "status,validUntil")})
public class Prescription {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private Long patientId;
    @Column(nullable = false)
    private Long doctorId;
    private Long appointmentId;
    @Column(nullable = false, length = 121)
    private String patientName;
    @Column(length = 120)
    private String patientEmail;
    @Column(nullable = false, length = 125)
    private String doctorName;
    @Column(length = 500)
    private String diagnosis;
    @Column(length = 1000)
    private String notes;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private PrescriptionStatus status = PrescriptionStatus.ACTIVE;
    @Column(nullable = false)
    private LocalDate validUntil;
    @Column(nullable = false, updatable = false)
    private Instant issuedAt = Instant.now();
    private Instant statusChangedAt;
    @OneToMany(mappedBy = "prescription", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PrescriptionItem> items = new ArrayList<>();

    public void addItem(PrescriptionItem i) {
        i.setPrescription(this);
        items.add(i);
    }
}
