package com.fooddelivery.order.repository;

import com.fooddelivery.order.model.CustomerAddress;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;

public interface CustomerAddressRepository extends ReactiveCrudRepository<CustomerAddress, Long> {

    Flux<CustomerAddress> findByCustomerId(Long customerId);
}
