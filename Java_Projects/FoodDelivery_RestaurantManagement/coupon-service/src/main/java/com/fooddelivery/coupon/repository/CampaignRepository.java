package com.fooddelivery.coupon.repository;

import com.fooddelivery.coupon.domain.Campaign;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface CampaignRepository extends JpaRepository<Campaign, Long> {
    List<Campaign> findByActiveTrueAndStartsAtLessThanEqualAndEndsAtGreaterThanEqual(Instant a, Instant b);
}
