package com.fooddelivery.order.service;

import com.fooddelivery.order.exception.ResourceNotFoundException;
import com.fooddelivery.order.model.OrderStatusHistory;
import com.fooddelivery.order.repository.OrderStatusHistoryRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/** Read-mostly: Order_Status_History is an append-only trail; rows are otherwise written internally by OrderService. */
@Service
public class OrderStatusHistoryService {

    private final OrderStatusHistoryRepository orderStatusHistoryRepository;

    public OrderStatusHistoryService(OrderStatusHistoryRepository orderStatusHistoryRepository) {
        this.orderStatusHistoryRepository = orderStatusHistoryRepository;
    }

    public Flux<OrderStatusHistory> findAll(Long orderId) {
        return orderId != null
                ? orderStatusHistoryRepository.findByOrderId(orderId)
                : orderStatusHistoryRepository.findAll();
    }

    public Mono<OrderStatusHistory> findById(Long id) {
        return orderStatusHistoryRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Order status history entry not found: " + id)));
    }

    public Mono<Void> delete(Long id) {
        return findById(id).flatMap(orderStatusHistoryRepository::delete);
    }
}
