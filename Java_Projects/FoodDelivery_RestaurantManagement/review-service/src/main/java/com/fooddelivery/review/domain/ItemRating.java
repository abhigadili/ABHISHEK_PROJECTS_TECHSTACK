package com.fooddelivery.review.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "item_ratings", indexes = @Index(name = "idx_itemrating_item", columnList = "menuItemId"))
@Getter @Setter @NoArgsConstructor
public class ItemRating {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "review_id")
    private Review review;
    @Column(nullable = false) private Long menuItemId;
    @Column(nullable = false, length = 120) private String itemName;
    @Column(nullable = false) private int rating;
}
