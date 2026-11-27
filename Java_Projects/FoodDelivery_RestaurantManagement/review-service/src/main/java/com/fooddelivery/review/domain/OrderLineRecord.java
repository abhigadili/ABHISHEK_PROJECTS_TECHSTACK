package com.fooddelivery.review.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** What was in the order (from order.confirmed): lets a review rate only dishes the customer actually received. */
@Entity
@Table(name = "order_lines", indexes = @Index(name = "idx_orderline_order", columnList = "orderId"),
        uniqueConstraints = @UniqueConstraint(name = "uk_orderline", columnNames = {"orderId", "menuItemId"}))
@Getter @Setter @NoArgsConstructor
public class OrderLineRecord {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private Long orderId;
    @Column(nullable = false) private Long menuItemId;
    @Column(nullable = false, length = 120) private String name;
}
