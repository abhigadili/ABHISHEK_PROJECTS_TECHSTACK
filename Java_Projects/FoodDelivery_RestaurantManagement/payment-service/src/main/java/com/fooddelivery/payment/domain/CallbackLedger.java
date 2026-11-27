package com.fooddelivery.payment.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** Remembers every provider callback id so a re-delivered webhook is acknowledged but not applied twice. */
@Entity
@Table(name = "payment_callbacks", uniqueConstraints = @UniqueConstraint(name = "uk_callback_event", columnNames = "providerEventId"))
@Getter @Setter @NoArgsConstructor
public class CallbackLedger {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 80) private String providerEventId;
    @Column(nullable = false) private Long orderId;
    @Column(nullable = false, length = 12) private String outcome;
    @Column(nullable = false) private Instant receivedAt = Instant.now();
}
