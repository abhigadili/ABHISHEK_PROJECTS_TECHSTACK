package com.fooddelivery.admin.event;

import com.fooddelivery.admin.service.AdminService;
import com.fooddelivery.common.kafka.EventConsumerSupport;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.kafka.Topics;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/** Consumer group "admin-service-group": builds the platform activity feed shown on the admin dashboard. */
@Component
public class AdminEventConsumer {
    private static final String G = "${spring.application.name}-group";
    private final EventConsumerSupport support;
    private final AdminService admin;

    public AdminEventConsumer(EventConsumerSupport support, AdminService admin) {
        this.support = support;
        this.admin = admin;
    }

    @KafkaListener(topics = Topics.RESTAURANT_REGISTERED, groupId = G)
    public void registered(ConsumerRecord<String, String> rec) {
        support.handle(rec, "AdminEventConsumer", Events.RestaurantRegistered.class, (env, e) -> admin.record("RESTAURANT", "Restaurant '" + e.name() + "' (" + e.city() + ") awaits approval"));
    }

    @KafkaListener(topics = Topics.RESTAURANT_APPROVED, groupId = G)
    public void approved(ConsumerRecord<String, String> rec) {
        support.handle(rec, "AdminEventConsumer", Events.RestaurantApproved.class, (env, e) -> admin.record("RESTAURANT", "Restaurant '" + e.name() + "': " + env.eventType()));
    }

    @KafkaListener(topics = Topics.ORDER_CONFIRMED, groupId = G)
    public void confirmed(ConsumerRecord<String, String> rec) {
        support.handle(rec, "AdminEventConsumer", Events.OrderConfirmed.class, (env, e) -> admin.record("ORDER", "Order " + e.orderNumber() + " confirmed (" + e.totalAmount() + ")"));
    }

    @KafkaListener(topics = Topics.PAYMENT_FAILED, groupId = G)
    public void paymentFailed(ConsumerRecord<String, String> rec) {
        support.handle(rec, "AdminEventConsumer", Events.PaymentFailed.class, (env, e) -> admin.record("PAYMENT", "Payment failed for order " + e.orderId() + ": " + e.reason()));
    }

    @KafkaListener(topics = Topics.REFUND_COMPLETED, groupId = G)
    public void refund(ConsumerRecord<String, String> rec) {
        support.handle(rec, "AdminEventConsumer", Events.RefundCompleted.class, (env, e) -> admin.record("REFUND", "Refund " + e.status() + " for order " + e.orderId() + " (" + e.amount() + ")"));
    }

    @KafkaListener(topics = Topics.INVENTORY_LOW_STOCK, groupId = G)
    public void lowStock(ConsumerRecord<String, String> rec) {
        support.handle(rec, "AdminEventConsumer", Events.LowStock.class, (env, e) -> admin.record("INVENTORY", "Low stock '" + e.ingredient() + "' at restaurant " + e.restaurantId()));
    }

    @KafkaListener(topics = Topics.DELIVERY_COMPLETED, groupId = G)
    public void delivered(ConsumerRecord<String, String> rec) {
        support.handle(rec, "AdminEventConsumer", Events.DeliveryCompleted.class, (env, e) -> admin.record("DELIVERY", "Order " + e.orderId() + " delivered by partner " + e.partnerUserId()));
    }
}
