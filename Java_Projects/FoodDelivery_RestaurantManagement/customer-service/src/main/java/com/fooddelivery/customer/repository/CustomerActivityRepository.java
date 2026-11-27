package com.fooddelivery.customer.repository;

import com.fooddelivery.customer.domain.CustomerActivity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerActivityRepository extends JpaRepository<CustomerActivity, Long> {
    Page<CustomerActivity> findByCustomerIdOrderByCreatedAtDesc(Long customerId, Pageable pageable);
}
