package com.fooddelivery.menu.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/** Portion size / variant (Half, Full, Large...). {@code extraPrice} is added to the item's base price. */
@Entity
@Table(name = "item_variants", uniqueConstraints = @UniqueConstraint(name = "uk_variant_item_name", columnNames = {"item_id", "name"}))
@Getter @Setter @NoArgsConstructor
public class ItemVariant {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "item_id")
    private MenuItem item;
    @Column(nullable = false, length = 40) private String name;
    @Column(nullable = false, precision = 10, scale = 2) private BigDecimal extraPrice = BigDecimal.ZERO;
}
