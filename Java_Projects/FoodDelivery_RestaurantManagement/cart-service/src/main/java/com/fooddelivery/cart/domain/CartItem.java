package com.fooddelivery.cart.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "cart_items", indexes = @Index(name = "idx_cart_items_cart", columnList = "cart_id"))
@Getter @Setter @NoArgsConstructor
public class CartItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "cart_id")
    private Cart cart;
    @Column(nullable = false) private Long menuItemId;
    @Column(nullable = false, length = 120) private String name;
    @Column(length = 40) private String variant;
    /** Comma separated add-on ids (the customisation selection). */
    @Column(length = 200) private String addOnIds;
    @Column(nullable = false) private int quantity;
    /** Price seen when added; informational only: the authoritative price is always re-read from menu-service. */
    @Column(nullable = false, precision = 10, scale = 2) private BigDecimal unitPriceSnapshot;
    @Column(length = 300) private String instructions;
}
