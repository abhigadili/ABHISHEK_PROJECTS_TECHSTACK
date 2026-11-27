package com.fooddelivery.inventory.domain;

import com.fooddelivery.common.jpa.AuditableEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/** Restaurant-specific stock item. {@code @Version} = optimistic locking for manual edits; consumption uses a pessimistic lock. */
@Entity
@Table(name = "ingredients", uniqueConstraints = @UniqueConstraint(name = "uk_ingredient_restaurant_name", columnNames = {"restaurantId", "name"}),
        indexes = @Index(name = "idx_ingredient_restaurant", columnList = "restaurantId"))
@Getter @Setter @NoArgsConstructor
public class Ingredient extends AuditableEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private Long restaurantId;
    @Column(nullable = false, length = 80) private String name;
    @Column(nullable = false, length = 16) private String unit;
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal quantity = BigDecimal.ZERO;
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal lowStockThreshold = BigDecimal.ZERO;
    @Version private Long version;

    public boolean isLow() { return quantity.compareTo(lowStockThreshold) <= 0; }
}
