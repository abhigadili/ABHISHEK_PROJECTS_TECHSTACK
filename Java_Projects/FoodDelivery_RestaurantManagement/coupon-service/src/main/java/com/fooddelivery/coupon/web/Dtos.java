package com.fooddelivery.coupon.web;

import com.fooddelivery.coupon.domain.Campaign;
import com.fooddelivery.coupon.domain.Coupon;
import com.fooddelivery.coupon.domain.CouponRedemption;
import jakarta.validation.constraints.*;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;

public final class Dtos {
    private Dtos() {}

    public record CouponRequest(@NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{3,40}", message = "3-40 letters, digits, - or _") String code,
                                @Size(max = 200) String description, @NotNull Coupon.DiscountType discountType,
                                @NotNull @DecimalMin("0.01") BigDecimal discountValue, @DecimalMin("0") BigDecimal minOrderValue,
                                @DecimalMin("0") BigDecimal maxDiscount, @NotNull Instant validFrom, @NotNull Instant validTo,
                                @Min(1) Integer totalUsageLimit, @Min(1) Integer perUserLimit, Long restaurantId, Long eligibleUserId, Long campaignId) {}

    public record ActiveRequest(boolean active) {}

    public record CouponDto(Long id, String code, String description, Coupon.DiscountType discountType, BigDecimal discountValue,
                            BigDecimal minOrderValue, BigDecimal maxDiscount, Instant validFrom, Instant validTo, boolean active,
                            Integer totalUsageLimit, Integer perUserLimit, int usedCount, Long restaurantId, Long eligibleUserId,
                            Long campaignId) implements Serializable {
        public static CouponDto from(Coupon c) {
            return new CouponDto(c.getId(), c.getCode(), c.getDescription(), c.getDiscountType(), c.getDiscountValue(), c.getMinOrderValue(),
                    c.getMaxDiscount(), c.getValidFrom(), c.getValidTo(), c.isActive(), c.getTotalUsageLimit(), c.getPerUserLimit(), c.getUsedCount(),
                    c.getRestaurantId(), c.getEligibleUserId(), c.getCampaignId());
        }
    }

    public record CheckRequest(@NotBlank String code, @NotNull Long customerId, Long restaurantId, @NotNull @DecimalMin("0") BigDecimal subtotal) {}
    public record CheckResponse(boolean valid, String code, BigDecimal discountAmount, String message) {}

    public record RedemptionDto(Long id, String code, Long customerId, Long orderId, BigDecimal discountAmount, Instant redeemedAt) {
        public static RedemptionDto from(CouponRedemption r) {
            return new RedemptionDto(r.getId(), r.getCoupon().getCode(), r.getCustomerId(), r.getOrderId(), r.getDiscountAmount(), r.getRedeemedAt());
        }
    }

    public record CampaignRequest(@NotBlank @Size(max = 100) String name, @Size(max = 400) String description, @Size(max = 120) String bannerText,
                                  @NotNull Instant startsAt, @NotNull Instant endsAt, boolean active) {}
    public record CampaignDto(Long id, String name, String description, String bannerText, Instant startsAt, Instant endsAt, boolean active) implements Serializable {
        public static CampaignDto from(Campaign c) {
            return new CampaignDto(c.getId(), c.getName(), c.getDescription(), c.getBannerText(), c.getStartsAt(), c.getEndsAt(), c.isActive());
        }
    }
}
