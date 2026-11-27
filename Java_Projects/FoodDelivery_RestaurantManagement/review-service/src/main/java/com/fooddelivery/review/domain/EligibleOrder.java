package com.fooddelivery.review.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** A delivered order that may be reviewed. Built ONLY from delivery.completed events: this is the eligibility rule. */
@Entity
@Table(name = "eligible_orders", indexes = @Index(name = "idx_eligible_customer", columnList = "customerId,reviewed"))
@Getter @Setter @NoArgsConstructor
public class EligibleOrder {
    @Id private Long orderId;
    @Column(nullable = false) private Long customerId;
    @Column(nullable = false) private Long restaurantId;
    private Long deliveryPartnerId;
    @Column(nullable = false) private Instant deliveredAt;
    @Column(nullable = false) private boolean reviewed;
}
