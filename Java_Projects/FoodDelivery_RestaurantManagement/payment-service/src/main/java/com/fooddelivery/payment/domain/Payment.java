package com.fooddelivery.payment.domain;

import com.fooddelivery.common.jpa.AuditableEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "payments", uniqueConstraints = @UniqueConstraint(name = "uk_payment_order", columnNames = "orderId"),
        indexes = {@Index(name = "idx_payment_customer", columnList = "customerId,createdAt"), @Index(name = "idx_payment_status_expiry", columnList = "status,expiresAt")})
@Getter @Setter @NoArgsConstructor
public class Payment extends AuditableEntity {
    public enum Status { PENDING, SUCCESS, FAILED, CANCELLED, REFUNDED }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    /** One payment per order: also the natural idempotency key for "initiate payment". */
    @Column(nullable = false) private Long orderId;
    @Column(nullable = false, length = 30) private String orderNumber;
    @Column(nullable = false) private Long customerId;
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal amount;
    @Column(nullable = false, length = 3) private String currency = "INR";
    @Column(nullable = false, length = 20) private String method;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 12) private Status status = Status.PENDING;
    @Column(nullable = false, length = 24) private String provider;
    /** true = no money moved: the provider is a sandbox. Surfaced in every API response. */
    @Column(nullable = false) private boolean sandbox;
    @Column(length = 60) private String providerRef;
    @Column(length = 40) private String scenario;
    @Column(length = 300) private String failureReason;
    @Column(nullable = false) private Instant expiresAt;
    private Instant paidAt;
    @Version private Long version;
}
