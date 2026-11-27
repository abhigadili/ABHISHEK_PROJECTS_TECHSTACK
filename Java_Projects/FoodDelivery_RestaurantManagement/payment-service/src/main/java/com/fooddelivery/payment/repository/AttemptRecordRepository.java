package com.fooddelivery.payment.repository;

import com.fooddelivery.payment.domain.AttemptRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AttemptRecordRepository extends JpaRepository<AttemptRecord, Long> {
    Optional<AttemptRecord> findByCustomerIdAndIdempotencyKey(Long customerId, String key);
}
