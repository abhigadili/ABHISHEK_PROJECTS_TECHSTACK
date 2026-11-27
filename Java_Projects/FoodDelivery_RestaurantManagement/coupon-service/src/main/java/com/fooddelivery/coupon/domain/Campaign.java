package com.fooddelivery.coupon.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** A named promotion ("Diwali Feast Week") that groups coupons. */
@Entity
@Table(name = "campaigns")
@Getter @Setter @NoArgsConstructor
public class Campaign {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 100) private String name;
    @Column(length = 400) private String description;
    @Column(length = 120) private String bannerText;
    @Column(nullable = false) private Instant startsAt;
    @Column(nullable = false) private Instant endsAt;
    @Column(nullable = false) private boolean active = true;
}
