package com.fooddelivery.order.service;

import com.fooddelivery.order.event.DeliveryStatusUpdatedEvent;
import com.fooddelivery.order.event.OrderCreatedEvent;
import com.fooddelivery.order.event.OrderEventProducer;
import com.fooddelivery.order.event.PaymentCompletedEvent;
import com.fooddelivery.order.exception.ResourceNotFoundException;
import com.fooddelivery.order.model.CustomerAddress;
import com.fooddelivery.order.model.Order;
import com.fooddelivery.order.model.OrderStatusHistory;
import com.fooddelivery.order.repository.CustomerAddressRepository;
import com.fooddelivery.order.repository.OrderRepository;
import com.fooddelivery.order.repository.OrderStatusHistoryRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.util.stream.Stream;

@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final CustomerAddressRepository customerAddressRepository;
    private final OrderStatusHistoryRepository orderStatusHistoryRepository;
    private final OrderEventProducer orderEventProducer;

    public OrderService(OrderRepository orderRepository,
                         CustomerAddressRepository customerAddressRepository,
                         OrderStatusHistoryRepository orderStatusHistoryRepository,
                         OrderEventProducer orderEventProducer) {
        this.orderRepository = orderRepository;
        this.customerAddressRepository = customerAddressRepository;
        this.orderStatusHistoryRepository = orderStatusHistoryRepository;
        this.orderEventProducer = orderEventProducer;
    }

    public Flux<Order> findAll(Long customerId, Long restaurantId) {
        if (customerId != null) {
            return orderRepository.findByCustomerId(customerId);
        }
        if (restaurantId != null) {
            return orderRepository.findByRestaurantId(restaurantId);
        }
        return orderRepository.findAll();
    }

    public Mono<Order> findById(Long id) {
        return orderRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Order not found: " + id)));
    }

    /**
     * Placing an order writes the Order row, appends a PLACED status entry,
     * then publishes OrderCreatedEvent — the one and only trigger for the
     * whole downstream choreography (payment-service, then delivery-service).
     * Nothing here calls either of those services directly.
     */
    public Mono<Order> create(Order order) {
        Order toSave = new Order(null, order.customerId(), order.restaurantId(), order.deliveryAddressId(),
                order.couponId(), "PLACED", order.totalAmount(),
                order.discountAmount() != null ? order.discountAmount() : BigDecimal.ZERO,
                order.deliveryFee() != null ? order.deliveryFee() : BigDecimal.ZERO,
                order.finalAmount(), null, null);

        return orderRepository.save(toSave)
                .flatMap(saved -> orderRepository.findById(saved.orderId()))
                .flatMap(saved -> logStatus(saved.orderId(), "PLACED", "Order placed by customer").thenReturn(saved))
                .flatMap(saved -> publishOrderCreated(saved).thenReturn(saved));
    }

    public Mono<Order> update(Long id, Order order) {
        return findById(id)
                .map(existing -> new Order(id, order.customerId(), order.restaurantId(), order.deliveryAddressId(),
                        order.couponId(), order.orderStatus(), order.totalAmount(), order.discountAmount(),
                        order.deliveryFee(), order.finalAmount(), existing.placedAt(), existing.updatedAt()))
                .flatMap(orderRepository::save);
    }

    public Mono<Void> delete(Long id) {
        return findById(id).flatMap(orderRepository::delete);
    }

    /** Called from the RabbitMQ listener when a PaymentCompletedEvent arrives. */
    public Mono<Order> applyPaymentResult(PaymentCompletedEvent event) {
        String newStatus = "SUCCESS".equalsIgnoreCase(event.status()) ? "CONFIRMED" : "PAYMENT_FAILED";
        String notes = "SUCCESS".equalsIgnoreCase(event.status())
                ? "Payment successful (ref " + event.transactionRef() + ")"
                : "Payment failed";
        return applyStatusChange(event.orderId(), newStatus, notes);
    }

    /** Called from the RabbitMQ listener when a DeliveryStatusUpdatedEvent arrives. */
    public Mono<Order> applyDeliveryStatus(DeliveryStatusUpdatedEvent event) {
        return applyStatusChange(event.orderId(), event.status(), event.notes());
    }

    private Mono<Order> applyStatusChange(Long orderId, String newStatus, String notes) {
        return findById(orderId)
                .flatMap(existing -> {
                    Order updated = new Order(existing.orderId(), existing.customerId(), existing.restaurantId(),
                            existing.deliveryAddressId(), existing.couponId(), newStatus, existing.totalAmount(),
                            existing.discountAmount(), existing.deliveryFee(), existing.finalAmount(),
                            existing.placedAt(), existing.updatedAt());
                    return orderRepository.save(updated);
                })
                .flatMap(saved -> logStatus(saved.orderId(), newStatus, notes).thenReturn(saved))
                .flatMap(saved -> orderRepository.findById(saved.orderId()));
    }

    private Mono<Void> publishOrderCreated(Order order) {
        return customerAddressRepository.findById(order.deliveryAddressId())
                .map(this::formatAddress)
                .defaultIfEmpty("Address #" + order.deliveryAddressId())
                .doOnNext(addressText -> orderEventProducer.publish(new OrderCreatedEvent(
                        order.orderId(), order.customerId(), order.restaurantId(), order.finalAmount(),
                        null, addressText)))
                .then();
    }

    private String formatAddress(CustomerAddress address) {
        return Stream.of(address.addressLine1(), address.city(), address.state(), address.postalCode())
                .filter(part -> part != null && !part.isBlank())
                .reduce((a, b) -> a + ", " + b)
                .orElse("Address #" + address.addressId());
    }

    private Mono<OrderStatusHistory> logStatus(Long orderId, String status, String notes) {
        return orderStatusHistoryRepository.save(new OrderStatusHistory(null, orderId, status, notes, null));
    }
}
