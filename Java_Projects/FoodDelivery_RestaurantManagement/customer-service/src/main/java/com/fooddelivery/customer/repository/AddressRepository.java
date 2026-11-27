package com.fooddelivery.customer.repository;

import com.fooddelivery.customer.domain.Address;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AddressRepository extends JpaRepository<Address, Long> {
    Optional<Address> findByIdAndCustomerUserId(Long id, Long userId);
}
