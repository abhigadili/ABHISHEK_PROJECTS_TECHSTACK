package com.fooddelivery.inventory.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/** How much of an ingredient ONE portion of a menu item consumes. */
@Entity
@Table(name = "recipes", uniqueConstraints = @UniqueConstraint(name = "uk_recipe_item_ingredient", columnNames = {"menuItemId", "ingredient_id"}),
        indexes = @Index(name = "idx_recipe_item", columnList = "menuItemId"))
@Getter @Setter @NoArgsConstructor
public class Recipe {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private Long restaurantId;
    @Column(nullable = false) private Long menuItemId;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "ingredient_id")
    private Ingredient ingredient;
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal quantityPerPortion;
}
