package com.fooddelivery.order.event;

import com.fooddelivery.common.kafka.EventProducer;
import com.fooddelivery.common.kafka.EventPublisher;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.kafka.Topics;
import com.fooddelivery.order.domain.CustomerOrder;
import com.fooddelivery.order.domain.OrderItem;
import com.fooddelivery.order.domain.OrderStatus;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

/**
 * OrderCreated / OrderConfirmed / OrderCancelled / OrderRejected / OrderStatusUpdated producers.
 * Key = order id, so every event of one order lands on the same partition and is consumed in order.
 */
@Component
@EventProducer(topics = {Topics.ORDER_CREATED, Topics.ORDER_CONFIRMED, Topics.ORDER_CANCELLED, Topics.ORDER_REJECTED, Topics.ORDER_STATUS_UPDATED})
public class OrderEventProducer {
    private final EventPublisher publisher;

    public OrderEventProducer(EventPublisher publisher) { this.publisher = publisher; }

    private static List<Events.OrderLine> lines(CustomerOrder o) {
        return o.getItems().stream().map((OrderItem i) -> new Events.OrderLine(i.getMenuItemId(), i.getName(), i.getQuantity(), i.getUnitPrice(), i.getVariant())).toList();
    }

    private void send(String topic, String type, CustomerOrder o, Object payload) {
        publisher.publish(topic, type, String.valueOf(o.getId()), String.valueOf(o.getId()), payload);
    }

    public void created(CustomerOrder o) {
        send(Topics.ORDER_CREATED, "OrderCreated", o, new Events.OrderCreated(o.getId(), o.getOrderNumber(), o.getCustomerId(), o.getRestaurantId(),
                o.getRestaurantOwnerUserId(), o.getTotalAmount(), o.getCouponCode(), lines(o)));
    }

    public void confirmed(CustomerOrder o) {
        send(Topics.ORDER_CONFIRMED, "OrderConfirmed", o, new Events.OrderConfirmed(o.getId(), o.getOrderNumber(), o.getCustomerId(), o.getRestaurantId(),
                o.getRestaurantOwnerUserId(), o.getTotalAmount(), o.getDiscountAmount(), o.getCouponCode(), lines(o),
                o.getDeliveryAddress().oneLine(), o.getDeliveryAddress().getCity()));
    }

    public void cancelled(CustomerOrder o, boolean refundRequired) {
        send(Topics.ORDER_CANCELLED, "OrderCancelled", o, new Events.OrderCancelled(o.getId(), o.getOrderNumber(), o.getCustomerId(), o.getRestaurantId(),
                o.getCancelReason(), o.getCancelledBy(), refundRequired, refundRequired ? o.getTotalAmount() : BigDecimal.ZERO, lines(o)));
    }

    public void rejected(CustomerOrder o, boolean refundRequired) {
        send(Topics.ORDER_REJECTED, "OrderRejected", o, new Events.OrderRejected(o.getId(), o.getOrderNumber(), o.getCustomerId(), o.getRestaurantId(),
                o.getCancelReason(), refundRequired, refundRequired ? o.getTotalAmount() : BigDecimal.ZERO, lines(o)));
    }

    public void statusUpdated(CustomerOrder o, OrderStatus from, OrderStatus to, String reason) {
        send(Topics.ORDER_STATUS_UPDATED, "OrderStatusUpdated", o, new Events.OrderStatusUpdated(o.getId(), o.getOrderNumber(), o.getCustomerId(),
                o.getRestaurantId(), o.getRestaurantOwnerUserId(), from == null ? null : from.name(), to.name(), reason, o.getTotalAmount(),
                o.getPickupAddress(), o.getDeliveryAddress().oneLine(), o.getDeliveryAddress().getCity(), o.getCustomerName()));
    }
}
