package com.fooddelivery.search.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/** Search-service's own read model of a restaurant, maintained only from Kafka events. */
@Entity
@Table(name = "indexed_restaurants", indexes = {@Index(name = "idx_ir_active_city", columnList = "active,city"), @Index(name = "idx_ir_name", columnList = "name")})
@Getter @Setter @NoArgsConstructor
public class IndexedRestaurant {
    @Id private Long restaurantId;
    @Column(nullable = false, length = 120) private String name;
    @Column(length = 80) private String city;
    @Column(length = 300) private String cuisines;
    @Column(length = 200) private String address;
    private Double latitude;
    private Double longitude;
    @Column(nullable = false) private boolean active;
    @Column(nullable = false) private boolean acceptingOrders;
    @Column(nullable = false, precision = 3, scale = 2) private BigDecimal rating = BigDecimal.ZERO;
    @Column(nullable = false) private long ratingCount;
}
