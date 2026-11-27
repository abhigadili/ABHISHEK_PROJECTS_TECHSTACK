package com.hospital.pharmacy.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One order per prescription (unique prescriptionId) - redelivered PrescriptionCreated events cannot create duplicates. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "pharmacy_orders",
        uniqueConstraints = @UniqueConstraint(name = "uk_order_prescription", columnNames = "prescriptionId"),
        indexes = @Index(name = "idx_order_status", columnList = "status,createdAt"))
public class PharmacyOrder {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private Long prescriptionId;
    @Column(nullable = false)
    private Long patientId;
    @Column(nullable = false, length = 121)
    private String patientName;
    @Column(length = 120)
    private String patientEmail;
    @Column(length = 125)
    private String doctorName;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private OrderStatus status = OrderStatus.PENDING;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;
    @Column(length = 60)
    private String dispensedBy;
    private Instant dispensedAt;
    @Column(length = 255)
    private String rejectionReason;
    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PharmacyOrderItem> items = new ArrayList<>();

    public void addItem(PharmacyOrderItem i) {
        i.setOrder(this);
        items.add(i);
    }
}
