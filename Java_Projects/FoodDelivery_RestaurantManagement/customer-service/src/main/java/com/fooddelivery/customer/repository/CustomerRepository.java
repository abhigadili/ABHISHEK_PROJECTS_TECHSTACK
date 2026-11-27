package com.fooddelivery.customer.repository;

import com.fooddelivery.customer.domain.Customer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface CustomerRepository extends JpaRepository<Customer, Long> {
    /** Entity graph = fetch join: loads the addresses with the customer in ONE query (avoids the N+1 problem). */
    @EntityGraph(attributePaths = "addresses")
    @Query("select c from Customer c where c.userId = :id")
    Optional<Customer> findWithAddresses(Long id);

    @Query("select c from Customer c where lower(c.fullName) like lower(concat('%', :q, '%')) or lower(c.email) like lower(concat('%', :q, '%'))")
    Page<Customer> search(String q, Pageable pageable);
}
