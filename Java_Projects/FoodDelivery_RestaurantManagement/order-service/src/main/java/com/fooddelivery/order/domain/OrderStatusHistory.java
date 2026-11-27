package com.fooddelivery.order.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** Every status change is recorded: this is the data behind order tracking. */
@Entity
@Table(name = "order_status_history", indexes = @Index(name = "idx_history_order", columnList = "order_id"))
@Getter @Setter @NoArgsConstructor
public class OrderStatusHistory {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "order_id")
    private CustomerOrder order;
    @Enumerated(EnumType.STRING) @Column(length = 24) private OrderStatus fromStatus;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 24) private OrderStatus toStatus;
    @Column(length = 300) private String reason;
    @Column(nullable = false, length = 100) private String actor;
    @Column(nullable = false) private Instant changedAt = Instant.now();
}
