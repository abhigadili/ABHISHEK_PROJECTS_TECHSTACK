package com.fooddelivery.order.repository;

import com.fooddelivery.order.model.OrderStatusHistory;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;

public interface OrderStatusHistoryRepository extends ReactiveCrudRepository<OrderStatusHistory, Long> {

    Flux<OrderStatusHistory> findByOrderId(Long orderId);
}
