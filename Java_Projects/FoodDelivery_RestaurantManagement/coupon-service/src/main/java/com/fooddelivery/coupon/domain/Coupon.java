package com.fooddelivery.coupon.domain;

import com.fooddelivery.common.jpa.AuditableEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "coupons", uniqueConstraints = @UniqueConstraint(name = "uk_coupon_code", columnNames = "code"),
        indexes = {@Index(name = "idx_coupon_active_dates", columnList = "active,validFrom,validTo"), @Index(name = "idx_coupon_restaurant", columnList = "restaurantId")})
@Getter @Setter @NoArgsConstructor
public class Coupon extends AuditableEntity {
    public enum DiscountType { PERCENTAGE, FIXED_AMOUNT }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 40) private String code;
    @Column(length = 200) private String description;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private DiscountType discountType;
    @Column(nullable = false, precision = 10, scale = 2) private BigDecimal discountValue;
    @Column(nullable = false, precision = 10, scale = 2) private BigDecimal minOrderValue = BigDecimal.ZERO;
    @Column(precision = 10, scale = 2) private BigDecimal maxDiscount;
    @Column(nullable = false) private Instant validFrom;
    @Column(nullable = false) private Instant validTo;
    @Column(nullable = false) private boolean active = true;
    private Integer totalUsageLimit;
    private Integer perUserLimit;
    @Column(nullable = false) private int usedCount;
    /** null = valid at every restaurant. */
    private Long restaurantId;
    /** null = every customer; otherwise only this user may use it. */
    private Long eligibleUserId;
    private Long campaignId;
    @Version private Long version;
}
