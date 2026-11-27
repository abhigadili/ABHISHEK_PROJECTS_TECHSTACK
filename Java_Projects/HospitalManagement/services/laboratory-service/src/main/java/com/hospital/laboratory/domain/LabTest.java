package com.hospital.laboratory.domain;

import java.math.BigDecimal;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Catalogue of tests the laboratory offers, with the price used for billing. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "lab_tests", uniqueConstraints = @UniqueConstraint(name = "uk_lab_test_code", columnNames = "code"))
public class LabTest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 30)
    private String code;
    @Column(nullable = false, length = 150)
    private String name;
    @Column(length = 60)
    private String sampleType;
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;
    private Integer turnaroundHours;
    @Column(nullable = false)
    private boolean active = true;
}
