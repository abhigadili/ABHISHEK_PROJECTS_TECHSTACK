package com.fooddelivery.notification.event;

import com.fooddelivery.common.kafka.EventConsumerSupport;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.kafka.Topics;
import com.fooddelivery.notification.service.NotificationService;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Consumer group "notification-service-group": turns business events into user notifications.
 * Each @KafkaListener handles one topic; duplicate and invalid events are filtered by {@link EventConsumerSupport}.
 */
@Component
public class NotificationEventConsumer {
    private static final String G = "${spring.application.name}-group";
    private final EventConsumerSupport support;
    private final NotificationService notifications;

    public NotificationEventConsumer(EventConsumerSupport support, NotificationService notifications) {
        this.support = support;
        this.notifications = notifications;
    }

    private <P> void on(ConsumerRecord<String, String> rec, Class<P> type, java.util.function.Consumer<P> h) {
        support.handle(rec, "NotificationEventConsumer", type, (env, p) -> h.accept(p));
    }

    @KafkaListener(topics = Topics.USER_REGISTERED, groupId = G)
    public void userRegistered(ConsumerRecord<String, String> rec) {
        on(rec, Events.UserRegistered.class, e -> notifications.notifyUser(e.userId(), "Welcome to FoodDelivery!",
                "Hi " + e.fullName() + ", your " + e.role().toLowerCase().replace('_', ' ') + " account is ready.", "REGISTRATION", "USER", e.userId()));
    }

    /** The topic also carries RestaurantSuspended/Rejected/Deactivated (same payload): only a real approval notifies. */
    @KafkaListener(topics = Topics.RESTAURANT_APPROVED, groupId = G)
    public void restaurantApproved(ConsumerRecord<String, String> rec) {
        support.handle(rec, "NotificationEventConsumer", Events.RestaurantApproved.class, (env, e) -> {
            if ("RestaurantApproved".equals(env.eventType()) && e.ownerUserId() > 0) {
                notifications.notifyUser(e.ownerUserId(), "Restaurant approved", "'" + e.name() + "' is now live and visible to customers.", "RESTAURANT_APPROVED", "RESTAURANT", e.restaurantId());
            } else if (!"RestaurantApproved".equals(env.eventType()) && e.ownerUserId() > 0) {
                notifications.notifyUser(e.ownerUserId(), "Restaurant status changed", "'" + e.name() + "' status: " + env.eventType().replace("Restaurant", "").toUpperCase() + ".", "RESTAURANT_STATUS", "RESTAURANT", e.restaurantId());
            }
        });
    }

    @KafkaListener(topics = Topics.ORDER_CREATED, groupId = G)
    public void orderCreated(ConsumerRecord<String, String> rec) {
        on(rec, Events.OrderCreated.class, e -> notifications.notifyUser(e.customerId(), "Order " + e.orderNumber() + " placed",
                "Your order of " + e.totalAmount() + " is waiting for payment.", "ORDER_CREATED", "ORDER", e.orderId()));
    }

    @KafkaListener(topics = Topics.PAYMENT_SUCCESS, groupId = G)
    public void paymentSuccess(ConsumerRecord<String, String> rec) {
        on(rec, Events.PaymentSuccess.class, e -> notifications.notifyUser(e.customerId(), "Payment confirmed",
                "We received your payment of " + e.amount() + " (ref " + e.transactionRef() + ").", "PAYMENT_SUCCESS", "ORDER", e.orderId()));
    }

    @KafkaListener(topics = Topics.PAYMENT_FAILED, groupId = G)
    public void paymentFailed(ConsumerRecord<String, String> rec) {
        on(rec, Events.PaymentFailed.class, e -> notifications.notifyUser(e.customerId(), "Payment failed", "Your payment could not be completed: " + e.reason(), "PAYMENT_FAILED", "ORDER", e.orderId()));
    }

    @KafkaListener(topics = Topics.ORDER_CONFIRMED, groupId = G)
    public void orderConfirmed(ConsumerRecord<String, String> rec) {
        on(rec, Events.OrderConfirmed.class, e -> {
            notifications.notifyUser(e.customerId(), "Order confirmed", "Order " + e.orderNumber() + " is confirmed and sent to the restaurant.", "ORDER_CONFIRMED", "ORDER", e.orderId());
            notifications.notifyUser(e.restaurantOwnerUserId(), "New order " + e.orderNumber(), "A paid order of " + e.totalAmount() + " is waiting for you to accept.", "NEW_ORDER", "ORDER", e.orderId());
        });
    }

    @KafkaListener(topics = Topics.ORDER_STATUS_UPDATED, groupId = G)
    public void orderStatus(ConsumerRecord<String, String> rec) {
        on(rec, Events.OrderStatusUpdated.class, e -> {
            switch (e.newStatus()) {
                case "RESTAURANT_ACCEPTED" -> notifications.notifyUser(e.customerId(), "Restaurant accepted your order", "Order " + e.orderNumber() + " was accepted by the restaurant.", "RESTAURANT_ACCEPTED", "ORDER", e.orderId());
                case "PREPARING" -> notifications.notifyUser(e.customerId(), "Your food is being prepared", "The kitchen started preparing order " + e.orderNumber() + ".", "PREPARING", "ORDER", e.orderId());
                case "READY_FOR_PICKUP" -> notifications.notifyUser(e.customerId(), "Order ready", "Order " + e.orderNumber() + " is ready; we are finding a delivery partner.", "READY_FOR_PICKUP", "ORDER", e.orderId());
                case "OUT_FOR_DELIVERY" -> notifications.notifyUser(e.customerId(), "Out for delivery", "Order " + e.orderNumber() + " is on its way to " + e.deliveryAddress() + ".", "OUT_FOR_DELIVERY", "ORDER", e.orderId());
                case "DELIVERED" -> notifications.notifyUser(e.customerId(), "Order delivered", "Enjoy your meal! Order " + e.orderNumber() + " was delivered. Please rate your experience.", "DELIVERED", "ORDER", e.orderId());
                default -> { /* other transitions are covered by dedicated events */ }
            }
        });
    }

    @KafkaListener(topics = Topics.ORDER_REJECTED, groupId = G)
    public void orderRejected(ConsumerRecord<String, String> rec) {
        on(rec, Events.OrderRejected.class, e -> notifications.notifyUser(e.customerId(), "Order rejected", "Order " + e.orderNumber() + " could not be fulfilled: " + e.reason()
                + (e.refundRequired() ? ". A refund will be issued." : ""), "ORDER_REJECTED", "ORDER", e.orderId()));
    }

    @KafkaListener(topics = Topics.ORDER_CANCELLED, groupId = G)
    public void orderCancelled(ConsumerRecord<String, String> rec) {
        on(rec, Events.OrderCancelled.class, e -> notifications.notifyUser(e.customerId(), "Order cancelled", "Order " + e.orderNumber() + " was cancelled"
                + (e.refundRequired() ? "; your refund of " + e.refundAmount() + " is being processed." : "."), "ORDER_CANCELLED", "ORDER", e.orderId()));
    }

    @KafkaListener(topics = Topics.REFUND_INITIATED, groupId = G)
    public void refundInitiated(ConsumerRecord<String, String> rec) {
        on(rec, Events.RefundInitiated.class, e -> notifications.notifyUser(e.customerId(), "Refund initiated", "A refund of " + e.amount() + " has been started.", "REFUND_INITIATED", "ORDER", e.orderId()));
    }

    @KafkaListener(topics = Topics.REFUND_COMPLETED, groupId = G)
    public void refundCompleted(ConsumerRecord<String, String> rec) {
        on(rec, Events.RefundCompleted.class, e -> notifications.notifyUser(e.customerId(),
                "COMPLETED".equals(e.status()) ? "Refund completed" : "Refund delayed",
                "COMPLETED".equals(e.status()) ? "Your refund of " + e.amount() + " has been completed." : "Your refund hit a problem and is being retried by our team.",
                "REFUND_" + e.status(), "ORDER", e.orderId()));
    }

    @KafkaListener(topics = Topics.DELIVERY_ASSIGNED, groupId = G)
    public void deliveryAssigned(ConsumerRecord<String, String> rec) {
        on(rec, Events.DeliveryAssigned.class, e -> notifications.notifyUser(e.partnerUserId(), "New delivery offer", "Pickup: " + e.pickupAddress() + " -> " + e.deliveryAddress() + ". Please accept soon.", "DELIVERY_OFFER", "ORDER", e.orderId()));
    }

    @KafkaListener(topics = Topics.DELIVERY_ACCEPTED, groupId = G)
    public void deliveryAccepted(ConsumerRecord<String, String> rec) {
        on(rec, Events.DeliveryAccepted.class, e -> notifications.notifyUser(e.customerId(), "Delivery partner assigned", "A delivery partner is heading to the restaurant.", "DELIVERY_ACCEPTED", "ORDER", e.orderId()));
    }

    @KafkaListener(topics = Topics.DELIVERY_PICKED_UP, groupId = G)
    public void deliveryPickedUp(ConsumerRecord<String, String> rec) {
        on(rec, Events.DeliveryPickedUp.class, e -> notifications.notifyUser(e.customerId(), "Order picked up", "Your food has been picked up by the delivery partner.", "PICKED_UP", "ORDER", e.orderId()));
    }

    @KafkaListener(topics = Topics.INVENTORY_LOW_STOCK, groupId = G)
    public void lowStock(ConsumerRecord<String, String> rec) {
        on(rec, Events.LowStock.class, e -> notifications.notifyUser(e.ownerUserId(), "Low stock: " + e.ingredient(), "Only " + e.quantity() + " " + e.unit() + " left (alert at " + e.threshold() + ").", "LOW_STOCK", "RESTAURANT", e.restaurantId()));
    }

    @KafkaListener(topics = Topics.NOTIFICATION_REQUESTED, groupId = G)
    public void requested(ConsumerRecord<String, String> rec) {
        on(rec, Events.NotificationRequested.class, e -> notifications.notifyUser(e.userId(), e.title(), e.message(), e.type() == null ? "GENERAL" : e.type(), null, null));
    }
}
