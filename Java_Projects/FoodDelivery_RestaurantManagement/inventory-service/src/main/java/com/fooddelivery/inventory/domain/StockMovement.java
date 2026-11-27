package com.fooddelivery.inventory.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

/** Append-only inventory history. */
@Entity
@Table(name = "stock_movements", indexes = {@Index(name = "idx_movement_ingredient", columnList = "ingredientId,createdAt"),
        @Index(name = "idx_movement_order", columnList = "orderId")})
@Getter @Setter @NoArgsConstructor
public class StockMovement {
    public enum Type { RESTOCK, ADJUSTMENT, CONSUMPTION, RETURN }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private Long ingredientId;
    @Column(nullable = false) private Long restaurantId;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 12) private Type type;
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal delta;
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal balanceAfter;
    @Column(length = 200) private String reason;
    private Long orderId;
    @Column(length = 100) private String actor;
    @Column(nullable = false) private Instant createdAt = Instant.now();
}
