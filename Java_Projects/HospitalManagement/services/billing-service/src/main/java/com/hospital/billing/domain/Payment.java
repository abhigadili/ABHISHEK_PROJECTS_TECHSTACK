package com.hospital.billing.domain;

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
@Table(name = "payments",
        uniqueConstraints = @UniqueConstraint(name = "uk_payment_txn", columnNames = "transactionRef"),
        indexes = @Index(name = "idx_payment_status", columnList = "status,initiatedAt"))
public class Payment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bill_id", nullable = false, foreignKey = @ForeignKey(name = "fk_payment_bill"))
    private Bill bill;
    @Column(nullable = false, length = 40)
    private String transactionRef;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private PaymentMethod method;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private PaymentStatus status = PaymentStatus.PENDING;
    @Column(length = 255)
    private String failureReason;
    @Column(nullable = false)
    private Instant initiatedAt = Instant.now();
    private Instant completedAt;
}
