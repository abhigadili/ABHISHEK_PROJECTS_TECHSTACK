package com.fooddelivery.menu.domain;

import com.fooddelivery.common.jpa.AuditableEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "menu_items", indexes = {@Index(name = "idx_item_restaurant_active", columnList = "restaurantId,active"),
        @Index(name = "idx_item_category", columnList = "category_id"), @Index(name = "idx_item_name", columnList = "name")})
@Getter @Setter @NoArgsConstructor
public class MenuItem extends AuditableEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private Long restaurantId;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "category_id")
    private MenuCategory category;
    @Column(nullable = false, length = 120) private String name;
    @Column(length = 600) private String description;
    @Column(nullable = false, precision = 10, scale = 2) private BigDecimal basePrice;
    @Column(nullable = false) private boolean vegetarian;
    /** Owner switch ("sold out today"). */
    @Column(nullable = false) private boolean available = true;
    /** false = soft-deleted: hidden from menus but kept so historic orders stay explainable. */
    @Column(nullable = false) private boolean active = true;
    @Column(length = 255) private String imageUrl;
    @Column(nullable = false) private int prepTimeMinutes = 15;
    @Column(length = 200) private String tags;
    // Sets (not Lists): Hibernate cannot fetch two "bags" in one query (MultipleBagFetchException). @OrderBy keeps insertion order.
    @OneToMany(mappedBy = "item", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id asc")
    private Set<ItemVariant> variants = new LinkedHashSet<>();
    @OneToMany(mappedBy = "item", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id asc")
    private Set<AddOn> addOns = new LinkedHashSet<>();
    @Version private Long version;
}
