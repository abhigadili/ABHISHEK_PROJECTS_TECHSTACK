package com.fooddelivery.payment.repository;

import com.fooddelivery.payment.domain.Refund;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface RefundRepository extends JpaRepository<Refund, Long> {
    @Query("select r from Refund r where r.payment.id = :paymentId")
    Optional<Refund> findByPaymentId(Long paymentId);
    Optional<Refund> findByOrderId(Long orderId);
    List<Refund> findTop20ByStatusOrderByCreatedAtAsc(Refund.Status status);
    Page<Refund> findByStatusOrderByCreatedAtDesc(Refund.Status status, Pageable pageable);
    Page<Refund> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
