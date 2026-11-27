package com.fooddelivery.order.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "order_items", indexes = @Index(name = "idx_order_items_order", columnList = "order_id"))
@Getter @Setter @NoArgsConstructor
public class OrderItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "order_id")
    private CustomerOrder order;
    @Column(nullable = false) private Long menuItemId;
    @Column(nullable = false, length = 120) private String name;
    @Column(length = 40) private String variant;
    @Column(length = 300) private String addOns;
    @Column(nullable = false) private int quantity;
    @Column(nullable = false, precision = 10, scale = 2) private BigDecimal unitPrice;
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal lineTotal;
    @Column(length = 300) private String instructions;
}
