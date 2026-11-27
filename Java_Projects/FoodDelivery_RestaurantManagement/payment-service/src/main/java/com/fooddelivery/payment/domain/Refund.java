package com.fooddelivery.payment.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "refunds", uniqueConstraints = @UniqueConstraint(name = "uk_refund_payment", columnNames = "payment_id"),
        indexes = @Index(name = "idx_refund_status", columnList = "status"))
@Getter @Setter @NoArgsConstructor
public class Refund {
    public enum Status { INITIATED, COMPLETED, FAILED }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "payment_id")
    private Payment payment;
    @Column(nullable = false) private Long orderId;
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal amount;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 12) private Status status = Status.INITIATED;
    @Column(length = 300) private String reason;
    @Column(length = 60) private String providerRef;
    @Column(length = 300) private String failureReason;
    @Column(nullable = false) private int attempts;
    @Column(nullable = false) private Instant createdAt = Instant.now();
    private Instant completedAt;
    @Version private Long version;
}
