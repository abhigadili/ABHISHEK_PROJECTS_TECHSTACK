package com.hospital.pharmacy.domain;

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
@Table(name = "medicines",
        uniqueConstraints = @UniqueConstraint(name = "uk_medicine_sku", columnNames = "sku"),
        indexes = {@Index(name = "idx_medicine_name", columnList = "name"), @Index(name = "idx_medicine_generic", columnList = "genericName")})
public class Medicine {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 40)
    private String sku;
    @Column(nullable = false, length = 150)
    private String name;
    @Column(length = 150)
    private String genericName;
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal unitPrice;
    @Column(nullable = false)
    private int stockQuantity;
    @Column(nullable = false)
    private int reorderLevel = 20;
    @Column(nullable = false)
    private boolean active = true;
    private Instant lastLowStockAlertAt;
    @Version
    private Long version;
}
