package com.fooddelivery.menu.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Orders-per-item counter fed by order.confirmed events ("popular items"). */
@Entity
@Table(name = "item_popularity", indexes = @Index(name = "idx_popularity_restaurant", columnList = "restaurantId,orderedQuantity"))
@Getter @Setter @NoArgsConstructor
public class ItemPopularity {
    @Id private Long menuItemId;
    @Column(nullable = false) private Long restaurantId;
    @Column(nullable = false) private long orderedQuantity;
}
