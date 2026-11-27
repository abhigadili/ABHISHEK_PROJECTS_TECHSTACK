package com.fooddelivery.review.domain;

import com.fooddelivery.common.jpa.AuditableEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "reviews", uniqueConstraints = @UniqueConstraint(name = "uk_review_order", columnNames = "orderId"),
        indexes = {@Index(name = "idx_review_restaurant_status", columnList = "restaurantId,status,createdAt"), @Index(name = "idx_review_partner", columnList = "deliveryPartnerId,status")})
@Getter @Setter @NoArgsConstructor
public class Review extends AuditableEntity {
    public enum Status { VISIBLE, HIDDEN }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private Long orderId;
    @Column(nullable = false) private Long customerId;
    @Column(nullable = false, length = 60) private String reviewerName;
    @Column(nullable = false) private Long restaurantId;
    private Long deliveryPartnerId;
    @Column(nullable = false) private int restaurantRating;
    private Integer deliveryRating;
    @Column(length = 1000) private String comment;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 8) private Status status = Status.VISIBLE;
    @Column(length = 300) private String moderationNote;
    @OneToMany(mappedBy = "review", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ItemRating> itemRatings = new ArrayList<>();
}
