package com.fooddelivery.order.repository;

import com.fooddelivery.order.model.Order;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;

public interface OrderRepository extends ReactiveCrudRepository<Order, Long> {

    Flux<Order> findByCustomerId(Long customerId);

    Flux<Order> findByRestaurantId(Long restaurantId);
}
