package com.fooddelivery.coupon.repository;

import com.fooddelivery.coupon.domain.Coupon;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface CouponRepository extends JpaRepository<Coupon, Long> {
    Optional<Coupon> findByCodeIgnoreCase(String code);
    boolean existsByCodeIgnoreCase(String code);

    @Query("select c from Coupon c where c.active = true and c.validFrom <= :now and c.validTo >= :now and c.eligibleUserId is null " +
            "and (c.restaurantId is null or c.restaurantId = :rid) and (c.totalUsageLimit is null or c.usedCount < c.totalUsageLimit) order by c.validTo")
    List<Coupon> findPublicActive(Instant now, Long rid);

    List<Coupon> findByCampaignId(Long campaignId);

    /** Atomic increment (no lost updates even with concurrent redemptions). */
    @Modifying
    @Query("update Coupon c set c.usedCount = c.usedCount + 1 where c.id = :id")
    int incrementUsed(Long id);
}
