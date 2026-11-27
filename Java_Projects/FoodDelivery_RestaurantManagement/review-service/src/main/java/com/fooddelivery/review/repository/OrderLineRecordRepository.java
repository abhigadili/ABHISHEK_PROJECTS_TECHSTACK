package com.fooddelivery.review.repository;

import com.fooddelivery.review.domain.OrderLineRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrderLineRecordRepository extends JpaRepository<OrderLineRecord, Long> {
    List<OrderLineRecord> findByOrderId(Long orderId);
    boolean existsByOrderId(Long orderId);
}
