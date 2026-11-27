package com.hospital.records.domain;

import java.time.Instant;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One item on the patient's clinical timeline. referenceType/referenceId point at the source in another service (logical link). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "record_entries",
        uniqueConstraints = @UniqueConstraint(name = "uk_entry_reference", columnNames = {"entryType", "referenceType", "referenceId"}),
        indexes = @Index(name = "idx_entry_patient_time", columnList = "patientId,recordedAt"))
public class RecordEntry {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "record_id", nullable = false, foreignKey = @ForeignKey(name = "fk_entry_record"))
    private PatientRecord record;
    @Column(nullable = false)
    private Long patientId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private EntryType entryType;
    @Column(nullable = false, length = 200)
    private String title;
    @Column(length = 4000)
    private String details;
    private Long doctorId;
    @Column(length = 30)
    private String referenceType;
    private Long referenceId;
    @Column(nullable = false, length = 10)
    private String source = "MANUAL";
    @Column(nullable = false)
    private Instant recordedAt = Instant.now();
}
