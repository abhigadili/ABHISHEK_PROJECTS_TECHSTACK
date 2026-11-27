package com.fooddelivery.payment.repository;

import com.fooddelivery.payment.domain.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long>, JpaSpecificationExecutor<Payment> {
    Optional<Payment> findByOrderId(Long orderId);
    List<Payment> findByCustomerIdOrderByCreatedAtDesc(Long customerId);
    List<Payment> findTop100ByStatusAndExpiresAtBefore(Payment.Status status, Instant now);

    @Query("select p.status, count(p), coalesce(sum(p.amount),0) from Payment p group by p.status")
    List<Object[]> summary();
}
