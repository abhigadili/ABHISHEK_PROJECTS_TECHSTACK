package com.fooddelivery.payment.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** Idempotency-Key ledger for the customer "pay" call: same key -> same stored answer, no second charge. */
@Entity
@Table(name = "payment_attempts", uniqueConstraints = @UniqueConstraint(name = "uk_attempt_key", columnNames = {"customerId", "idempotencyKey"}))
@Getter @Setter @NoArgsConstructor
public class AttemptRecord {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private Long customerId;
    @Column(nullable = false, length = 64) private String idempotencyKey;
    @Column(nullable = false) private Long paymentId;
    @Column(nullable = false, length = 12) private String resultStatus;
    @Column(nullable = false) private Instant createdAt = Instant.now();
}
