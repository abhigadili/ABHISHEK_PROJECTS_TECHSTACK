package com.fooddelivery.review.repository;

import com.fooddelivery.review.domain.EligibleOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EligibleOrderRepository extends JpaRepository<EligibleOrder, Long> {
    List<EligibleOrder> findByCustomerIdAndReviewedFalseOrderByDeliveredAtDesc(Long customerId);
}
