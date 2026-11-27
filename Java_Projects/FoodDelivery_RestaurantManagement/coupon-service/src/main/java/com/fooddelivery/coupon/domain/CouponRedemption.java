package com.fooddelivery.coupon.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "coupon_redemptions", uniqueConstraints = @UniqueConstraint(name = "uk_redemption_order", columnNames = "orderId"),
        indexes = {@Index(name = "idx_redemption_coupon_customer", columnList = "coupon_id,customerId")})
@Getter @Setter @NoArgsConstructor
public class CouponRedemption {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "coupon_id")
    private Coupon coupon;
    @Column(nullable = false) private Long customerId;
    @Column(nullable = false) private Long orderId;
    @Column(nullable = false, precision = 10, scale = 2) private BigDecimal discountAmount;
    @Column(nullable = false) private Instant redeemedAt = Instant.now();
}
