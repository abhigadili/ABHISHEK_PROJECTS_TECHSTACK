package com.fooddelivery.coupon.repository;

import com.fooddelivery.coupon.domain.CouponRedemption;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CouponRedemptionRepository extends JpaRepository<CouponRedemption, Long> {
    long countByCouponIdAndCustomerId(Long couponId, Long customerId);
    boolean existsByOrderId(Long orderId);
    Page<CouponRedemption> findByCouponIdOrderByRedeemedAtDesc(Long couponId, Pageable pageable);
}
