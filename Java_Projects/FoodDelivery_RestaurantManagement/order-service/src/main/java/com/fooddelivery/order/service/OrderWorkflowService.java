package com.fooddelivery.order.service;

import com.fooddelivery.common.aop.Audited;
import com.fooddelivery.common.exception.BusinessException;
import com.fooddelivery.common.exception.ForbiddenException;
import com.fooddelivery.common.exception.NotFoundException;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.security.AuthUser;
import com.fooddelivery.common.security.SecurityUtils;
import com.fooddelivery.order.domain.CustomerOrder;
import com.fooddelivery.order.domain.OrderStatus;
import com.fooddelivery.order.event.OrderEventProducer;
import com.fooddelivery.order.repository.OrderRepository;
import com.fooddelivery.order.web.Dtos;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * Everything that CHANGES an order after placement: restaurant/customer/admin actions (REST) and Saga steps
 * (Kafka events from payment, inventory, delivery). All status changes go through {@link OrderStateMachine}.
 *
 * Saga (choreography) summary:
 *   payment.success  -> CONFIRMED  (+ order.confirmed)      payment.failed -> PAYMENT_FAILED
 *   restaurant rejects / inventory.reservation-failed -> REJECTED (+ order.rejected) -> refund.initiated -> REFUND_PENDING -> refund.completed -> REFUNDED
 *   customer cancels -> CANCELLED (+ order.cancelled)  -> same refund tail when the order was paid
 *   delivery.picked-up -> PICKED_UP -> OUT_FOR_DELIVERY ; delivery.completed -> DELIVERED
 */
@Service
public class OrderWorkflowService {
    private static final Logger log = LoggerFactory.getLogger(OrderWorkflowService.class);
    private final OrderRepository orders;
    private final OrderStateMachine machine;
    private final OrderEventProducer events;

    public OrderWorkflowService(OrderRepository orders, OrderStateMachine machine, OrderEventProducer events) {
        this.orders = orders;
        this.machine = machine;
        this.events = events;
    }

    // ===================================================================== REST actions
    @Audited("ORDER_ACCEPT")
    @Transactional
    public Dtos.OrderDto accept(Long id) {
        CustomerOrder o = restaurantOrder(id);
        machine.transition(o, OrderStatus.RESTAURANT_ACCEPTED, "Accepted by restaurant", actor());
        return view(o);
    }

    @Audited("ORDER_REJECT")
    @Transactional
    public Dtos.OrderDto reject(Long id, String reason) {
        CustomerOrder o = restaurantOrder(id);
        o.setCancelReason(reason == null || reason.isBlank() ? "Rejected by restaurant" : reason);
        o.setCancelledBy("RESTAURANT");
        machine.transition(o, OrderStatus.REJECTED, o.getCancelReason(), actor());
        events.rejected(o, true);          // paid order: payment-service will refund
        return view(o);
    }

    @Transactional
    public Dtos.OrderDto startPreparing(Long id) {
        CustomerOrder o = restaurantOrder(id);
        machine.transition(o, OrderStatus.PREPARING, "Preparing food", actor());
        return view(o);
    }

    @Transactional
    public Dtos.OrderDto markReady(Long id) {
        CustomerOrder o = restaurantOrder(id);
        machine.transition(o, OrderStatus.READY_FOR_PICKUP, "Ready for pickup", actor());
        return view(o);
    }

    @Audited("ORDER_CANCEL")
    @Transactional
    public Dtos.OrderDto cancel(Long id, String reason) {
        AuthUser u = SecurityUtils.requireUser();
        CustomerOrder o = detailed(id);
        boolean admin = u.isAdmin();
        if (!admin && u.userId() != o.getCustomerId()) throw new ForbiddenException("This is not your order");
        if (!o.getStatus().customerCancellable()) {
            throw new BusinessException(HttpStatus.CONFLICT, "NOT_CANCELLABLE", "Order " + o.getOrderNumber() + " can no longer be cancelled (status " + o.getStatus() + ")");
        }
        boolean paid = o.getStatus().isPaid();
        o.setCancelReason(reason == null || reason.isBlank() ? "Cancelled by " + (admin ? "admin" : "customer") : reason);
        o.setCancelledBy(admin ? "ADMIN" : "CUSTOMER");
        machine.transition(o, OrderStatus.CANCELLED, o.getCancelReason(), actor());
        events.cancelled(o, paid);          // paid -> refund; unpaid -> payment-service just cancels the pending payment
        return view(o);
    }

    // ===================================================================== Saga steps (Kafka)
    @Transactional
    public void onPaymentSuccess(Events.PaymentSuccess e) {
        CustomerOrder o = find(e.orderId());
        if (o == null) return;
        if (o.getStatus() != OrderStatus.PAYMENT_PENDING) {
            log.warn("payment.success for order {} ignored: status is {} (late or duplicate)", o.getOrderNumber(), o.getStatus());
            return;
        }
        machine.transition(o, OrderStatus.CONFIRMED, "Payment received (" + e.transactionRef() + ")", "payment-service");
        events.confirmed(o);
    }

    @Transactional
    public void onPaymentFailed(Events.PaymentFailed e) {
        CustomerOrder o = find(e.orderId());
        if (o == null) return;
        if (o.getStatus() != OrderStatus.PAYMENT_PENDING) {
            log.warn("payment.failed for order {} ignored: status is {}", o.getOrderNumber(), o.getStatus());
            return;
        }
        o.setCancelReason("Payment failed: " + e.reason());
        machine.transition(o, OrderStatus.PAYMENT_FAILED, e.reason(), "payment-service");
    }

    /** Compensation: inventory could not fulfil a paid order -> reject it (refund follows). */
    @Transactional
    public void onReservationFailed(Events.ReservationFailed e) {
        CustomerOrder o = find(e.orderId());
        if (o == null) return;
        if (o.getStatus() != OrderStatus.CONFIRMED && o.getStatus() != OrderStatus.RESTAURANT_ACCEPTED) {
            log.warn("reservation-failed for order {} ignored: status is {}", o.getOrderNumber(), o.getStatus());
            return;
        }
        o.setCancelReason(e.reason());
        o.setCancelledBy("SYSTEM");
        machine.transition(o, OrderStatus.REJECTED, e.reason(), "inventory-service");
        events.rejected(o, true);
    }

    @Transactional
    public void onRefundInitiated(Events.RefundInitiated e) {
        CustomerOrder o = find(e.orderId());
        if (o == null) return;
        if (o.getStatus() == OrderStatus.CANCELLED || o.getStatus() == OrderStatus.REJECTED) {
            machine.transition(o, OrderStatus.REFUND_PENDING, "Refund of " + e.amount() + " initiated", "payment-service");
        } else {
            log.warn("refund.initiated for order {} ignored: status is {}", o.getOrderNumber(), o.getStatus());
        }
    }

    @Transactional
    public void onRefundCompleted(Events.RefundCompleted e) {
        CustomerOrder o = find(e.orderId());
        if (o == null) return;
        if ("COMPLETED".equals(e.status())) {
            if (o.getStatus() == OrderStatus.CANCELLED || o.getStatus() == OrderStatus.REJECTED) {
                machine.transition(o, OrderStatus.REFUND_PENDING, "Refund started", "payment-service");
            }
            if (o.getStatus() == OrderStatus.REFUND_PENDING) machine.transition(o, OrderStatus.REFUNDED, "Refund of " + e.amount() + " completed", "payment-service");
        } else {
            machine.note(o, "Refund FAILED: " + e.reason() + " (admin can retry)", "payment-service");   // stays REFUND_PENDING
        }
    }

    @Transactional
    public void onDeliveryPickedUp(Events.DeliveryPickedUp e) {
        CustomerOrder o = find(e.orderId());
        if (o == null) return;
        if (o.getStatus() != OrderStatus.READY_FOR_PICKUP) {
            log.warn("delivery.picked-up for order {} ignored: status is {}", o.getOrderNumber(), o.getStatus());
            return;
        }
        machine.transition(o, OrderStatus.PICKED_UP, "Picked up by delivery partner " + e.partnerUserId(), "delivery-service");
        machine.transition(o, OrderStatus.OUT_FOR_DELIVERY, "On the way to the customer", "delivery-service");
    }

    @Transactional
    public void onDeliveryCompleted(Events.DeliveryCompleted e) {
        CustomerOrder o = find(e.orderId());
        if (o == null) return;
        if (o.getStatus() != OrderStatus.OUT_FOR_DELIVERY) {
            log.warn("delivery.completed for order {} ignored: status is {}", o.getOrderNumber(), o.getStatus());
            return;
        }
        machine.transition(o, OrderStatus.DELIVERED, "Delivered", "delivery-service");
    }

    // ===================================================================== helpers
    private CustomerOrder find(Long orderId) {
        return orders.findDetailed(orderId).orElseGet(() -> { log.warn("Event refers to unknown order {}", orderId); return null; });
    }

    private CustomerOrder detailed(Long id) { return orders.findDetailed(id).orElseThrow(() -> new NotFoundException("Order", id)); }

    private CustomerOrder restaurantOrder(Long id) {
        AuthUser u = SecurityUtils.requireUser();
        CustomerOrder o = detailed(id);
        if (!u.isAdmin() && u.userId() != o.getRestaurantOwnerUserId()) throw new ForbiddenException("This order belongs to another restaurant");
        return o;
    }

    private String actor() {
        return SecurityUtils.currentUser().map(u -> u.username() + "#" + u.userId()).orElse("system");
    }

    private Dtos.OrderDto view(CustomerOrder o) { return Dtos.OrderDto.from(o, allowedActions(o, SecurityUtils.currentUser().orElse(null))); }

    /** Tells the UI which buttons make sense; the backend still enforces every rule independently. */
    public static List<String> allowedActions(CustomerOrder o, AuthUser u) {
        List<String> a = new ArrayList<>();
        if (u == null) return a;
        boolean owner = u.isAdmin() || u.userId() == o.getRestaurantOwnerUserId();
        boolean customer = u.isAdmin() || u.userId() == o.getCustomerId();
        OrderStatus s = o.getStatus();
        if (customer && s.customerCancellable()) a.add("CANCEL");
        if (owner) {
            if (s == OrderStatus.CONFIRMED) { a.add("ACCEPT"); a.add("REJECT"); }
            if (s == OrderStatus.RESTAURANT_ACCEPTED) { a.add("PREPARE"); a.add("REJECT"); }
            if (s == OrderStatus.PREPARING) a.add("READY");
        }
        return a;
    }
}
