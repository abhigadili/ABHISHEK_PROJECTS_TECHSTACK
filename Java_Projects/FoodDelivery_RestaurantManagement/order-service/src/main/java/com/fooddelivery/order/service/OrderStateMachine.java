package com.fooddelivery.order.service;

import com.fooddelivery.common.exception.BusinessException;
import com.fooddelivery.order.domain.CustomerOrder;
import com.fooddelivery.order.domain.OrderStatus;
import com.fooddelivery.order.domain.OrderStatusHistory;
import com.fooddelivery.order.event.OrderEventProducer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** The single gate through which an order status can change: validates the transition, writes history, emits the event. */
@Component
public class OrderStateMachine {
    private static final Logger log = LoggerFactory.getLogger(OrderStateMachine.class);
    private final OrderEventProducer events;

    public OrderStateMachine(OrderEventProducer events) { this.events = events; }

    public void transition(CustomerOrder o, OrderStatus to, String reason, String actor) {
        OrderStatus from = o.getStatus();
        if (!from.canMoveTo(to)) {
            throw new BusinessException(HttpStatus.CONFLICT, "INVALID_TRANSITION",
                    "Order " + o.getOrderNumber() + " cannot move from " + from + " to " + to);
        }
        o.setStatus(to);
        OrderStatusHistory h = new OrderStatusHistory();
        h.setFromStatus(from);
        h.setToStatus(to);
        h.setReason(reason);
        h.setActor(actor);
        o.addHistory(h);
        events.statusUpdated(o, from, to, reason);
        log.info("Order {} status {} -> {} by {}", o.getOrderNumber(), from, to, actor);
    }

    public void note(CustomerOrder o, String reason, String actor) {
        OrderStatusHistory h = new OrderStatusHistory();
        h.setFromStatus(o.getStatus());
        h.setToStatus(o.getStatus());
        h.setReason(reason);
        h.setActor(actor);
        o.addHistory(h);
        log.info("Order {} note: {}", o.getOrderNumber(), reason);
    }
}
