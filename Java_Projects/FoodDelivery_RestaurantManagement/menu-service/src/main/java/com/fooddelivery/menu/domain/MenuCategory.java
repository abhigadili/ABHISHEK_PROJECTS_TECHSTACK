package com.fooddelivery.menu.domain;

import com.fooddelivery.common.jpa.AuditableEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A restaurant's own menu section (Starters, Biryani, Desserts...). */
@Entity
@Table(name = "menu_categories", uniqueConstraints = @UniqueConstraint(name = "uk_category_restaurant_name", columnNames = {"restaurantId", "name"}),
        indexes = @Index(name = "idx_category_restaurant", columnList = "restaurantId"))
@Getter @Setter @NoArgsConstructor
public class MenuCategory extends AuditableEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private Long restaurantId;
    @Column(nullable = false, length = 60) private String name;
    @Column(length = 200) private String description;
    @Column(nullable = false) private int displayOrder;
    @Column(nullable = false) private boolean active = true;
}
