package com.fooddelivery.payment.repository;

import com.fooddelivery.payment.domain.SavedMethod;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SavedMethodRepository extends JpaRepository<SavedMethod, Long> {
    List<SavedMethod> findByCustomerIdOrderByIdDesc(Long customerId);
    Optional<SavedMethod> findByIdAndCustomerId(Long id, Long customerId);
}
