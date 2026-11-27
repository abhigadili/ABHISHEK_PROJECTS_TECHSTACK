package com.hospital.billing.domain;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    Optional<Payment> findByTransactionRef(String transactionRef);

    List<Payment> findByBillIdOrderByInitiatedAtDesc(Long billId);

    boolean existsByBillIdAndStatus(Long billId, PaymentStatus status);

    List<Payment> findByStatusAndInitiatedAtBefore(PaymentStatus status, Instant before);
}
