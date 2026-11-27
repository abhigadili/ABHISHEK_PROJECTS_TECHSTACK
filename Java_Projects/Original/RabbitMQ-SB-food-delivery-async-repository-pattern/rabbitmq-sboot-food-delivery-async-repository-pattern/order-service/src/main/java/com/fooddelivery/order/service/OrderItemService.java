package com.fooddelivery.order.service;

import com.fooddelivery.order.exception.ResourceNotFoundException;
import com.fooddelivery.order.model.OrderItem;
import com.fooddelivery.order.repository.OrderItemRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
public class OrderItemService {

    private final OrderItemRepository orderItemRepository;

    public OrderItemService(OrderItemRepository orderItemRepository) {
        this.orderItemRepository = orderItemRepository;
    }

    public Flux<OrderItem> findAll(Long orderId) {
        return orderId != null ? orderItemRepository.findByOrderId(orderId) : orderItemRepository.findAll();
    }

    public Mono<OrderItem> findById(Long id) {
        return orderItemRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Order item not found: " + id)));
    }

    public Mono<OrderItem> create(OrderItem item) {
        OrderItem toSave = new OrderItem(null, item.orderId(), item.menuItemId(), item.itemName(),
                item.quantity(), item.unitPrice(), item.subtotal());
        return orderItemRepository.save(toSave);
    }

    public Mono<OrderItem> update(Long id, OrderItem item) {
        return findById(id)
                .map(existing -> new OrderItem(id, item.orderId(), item.menuItemId(), item.itemName(),
                        item.quantity(), item.unitPrice(), item.subtotal()))
                .flatMap(orderItemRepository::save);
    }

    public Mono<Void> delete(Long id) {
        return findById(id).flatMap(orderItemRepository::delete);
    }
}
