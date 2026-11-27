package com.fooddelivery.menu.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/** Optional extra (extra cheese, raita...). */
@Entity
@Table(name = "item_addons")
@Getter @Setter @NoArgsConstructor
public class AddOn {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "item_id")
    private MenuItem item;
    @Column(nullable = false, length = 60) private String name;
    @Column(nullable = false, precision = 10, scale = 2) private BigDecimal price;
    @Column(nullable = false) private boolean available = true;
}
