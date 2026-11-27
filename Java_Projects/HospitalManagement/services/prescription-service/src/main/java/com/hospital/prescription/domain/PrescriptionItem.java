package com.hospital.prescription.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "prescription_items")
public class PrescriptionItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "prescription_id", nullable = false, foreignKey = @ForeignKey(name = "fk_rx_item_prescription"))
    private Prescription prescription;
    @Column(nullable = false, length = 150)
    private String medicineName;
    @Column(nullable = false, length = 60)
    private String dosage;
    @Column(nullable = false, length = 80)
    private String frequency;
    @Column(nullable = false)
    private Integer durationDays;
    @Column(nullable = false)
    private Integer quantity;
    @Column(length = 255)
    private String instructions;
}
