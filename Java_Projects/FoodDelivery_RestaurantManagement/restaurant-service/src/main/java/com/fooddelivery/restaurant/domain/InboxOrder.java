package com.fooddelivery.restaurant.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

/** The restaurant's own read model of orders it receives, built purely from Kafka events (no cross-service DB access). */
@Entity
@Table(name = "inbox_orders", uniqueConstraints = @UniqueConstraint(name = "uk_inbox_order", columnNames = "orderId"),
        indexes = @Index(name = "idx_inbox_restaurant_status", columnList = "restaurantId,status"))
@Getter @Setter @NoArgsConstructor
public class InboxOrder {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private Long orderId;
    @Column(nullable = false, length = 30) private String orderNumber;
    @Column(nullable = false) private Long restaurantId;
    @Column(nullable = false) private Long customerId;
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal totalAmount;
    @Column(nullable = false, length = 30) private String status;
    @Column(nullable = false) private Instant receivedAt = Instant.now();
    @Column(nullable = false) private Instant updatedAt = Instant.now();
}
