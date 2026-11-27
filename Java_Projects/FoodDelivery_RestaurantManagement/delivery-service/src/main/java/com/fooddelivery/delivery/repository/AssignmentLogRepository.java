package com.fooddelivery.delivery.repository;

import com.fooddelivery.delivery.domain.AssignmentLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AssignmentLogRepository extends JpaRepository<AssignmentLog, Long> {
    List<AssignmentLog> findByDeliveryIdOrderByIdAsc(Long deliveryId);
}
