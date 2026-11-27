package com.fooddelivery.restaurant.domain;

import com.fooddelivery.common.jpa.AuditableEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Entity
@Table(name = "restaurants", indexes = {
        @Index(name = "idx_restaurants_owner", columnList = "ownerUserId"),
        @Index(name = "idx_restaurants_status_city", columnList = "status,city"),
        @Index(name = "idx_restaurants_geo", columnList = "latitude,longitude")})
@Getter @Setter @NoArgsConstructor
public class Restaurant extends AuditableEntity {
    public enum Status { PENDING, APPROVED, REJECTED, SUSPENDED, DEACTIVATED }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private Long ownerUserId;
    @Column(nullable = false, length = 120) private String name;
    @Column(length = 1000) private String description;
    @Column(length = 40) private String category;
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "restaurant_cuisines", joinColumns = @JoinColumn(name = "restaurant_id"))
    @Column(name = "cuisine", length = 40)
    private Set<String> cuisines = new TreeSet<>();
    private boolean pureVeg;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16)
    private Status status = Status.PENDING;
    /** Owner-controlled availability switch ("accepting orders"). */
    @Column(name = "accepting_orders", nullable = false) private boolean open = true;
    @Column(length = 20) private String phone;
    @Column(length = 150) private String email;
    @Column(nullable = false, length = 200) private String addressLine;
    @Column(nullable = false, length = 80) private String city;
    @Column(length = 80) private String state;
    @Column(length = 12) private String postalCode;
    private Double latitude;
    private Double longitude;
    @Column(length = 255) private String logoUrl;
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "restaurant_images", joinColumns = @JoinColumn(name = "restaurant_id"))
    @Column(name = "image_url", length = 255)
    private List<String> imageUrls = new ArrayList<>();
    @Column(nullable = false, precision = 3, scale = 2) private BigDecimal avgRating = BigDecimal.ZERO;
    @Column(nullable = false) private long ratingCount;
    @Column(nullable = false, precision = 10, scale = 2) private BigDecimal minOrderAmount = BigDecimal.ZERO;
    @Column(nullable = false, precision = 10, scale = 2) private BigDecimal deliveryFee = new BigDecimal("30.00");
    @Column(nullable = false) private int prepTimeMinutes = 25;
    private Instant approvedAt;
    @Column(length = 100) private String approvedBy;
    @Column(length = 300) private String statusReason;
    @OneToMany(mappedBy = "restaurant", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("dayOfWeek asc")
    private List<OpeningHour> hours = new ArrayList<>();
    @Version private Long version;
}
