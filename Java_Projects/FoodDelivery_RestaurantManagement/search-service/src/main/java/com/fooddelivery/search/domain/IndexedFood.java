package com.fooddelivery.search.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "indexed_foods", indexes = {@Index(name = "idx_if_restaurant", columnList = "restaurantId"), @Index(name = "idx_if_name", columnList = "name"), @Index(name = "idx_if_category", columnList = "category")})
@Getter @Setter @NoArgsConstructor
public class IndexedFood {
    @Id private Long menuItemId;
    @Column(nullable = false) private Long restaurantId;
    @Column(nullable = false, length = 120) private String name;
    @Column(length = 600) private String description;
    @Column(length = 60) private String category;
    @Column(nullable = false, precision = 10, scale = 2) private BigDecimal price;
    @Column(nullable = false) private boolean vegetarian;
    @Column(nullable = false) private boolean available;
    @Column(length = 255) private String imageUrl;
}
