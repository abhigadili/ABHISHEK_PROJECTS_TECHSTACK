package com.fooddelivery.customer.event;

import com.fooddelivery.common.kafka.EventConsumerSupport;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.kafka.Topics;
import com.fooddelivery.customer.service.CustomerService;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/** Consumer group "customer-service-group": builds customer profiles and the activity timeline from events. */
@Component
public class CustomerEventConsumer {
    private final EventConsumerSupport support;
    private final CustomerService customers;

    public CustomerEventConsumer(EventConsumerSupport support, CustomerService customers) {
        this.support = support;
        this.customers = customers;
    }

    @KafkaListener(topics = Topics.USER_REGISTERED, groupId = "${spring.application.name}-group")
    public void onUserRegistered(ConsumerRecord<String, String> rec) {
        support.handle(rec, "CustomerEventConsumer", Events.UserRegistered.class, (env, e) -> {
            if ("CUSTOMER".equals(e.role())) customers.onUserRegistered(e);     // other roles are not customers: ignore
        });
    }

    @KafkaListener(topics = Topics.ORDER_CREATED, groupId = "${spring.application.name}-group")
    public void onOrderCreated(ConsumerRecord<String, String> rec) {
        support.handle(rec, "CustomerEventConsumer", Events.OrderCreated.class,
                (env, e) -> customers.recordActivity(e.customerId(), "ORDER_PLACED", "Order " + e.orderNumber() + " placed (" + e.totalAmount() + ")"));
    }

    @KafkaListener(topics = Topics.ORDER_STATUS_UPDATED, groupId = "${spring.application.name}-group")
    public void onOrderStatus(ConsumerRecord<String, String> rec) {
        support.handle(rec, "CustomerEventConsumer", Events.OrderStatusUpdated.class, (env, e) -> {
            if ("DELIVERED".equals(e.newStatus()) || "CANCELLED".equals(e.newStatus()) || "REFUNDED".equals(e.newStatus())) {
                customers.recordActivity(e.customerId(), "ORDER_" + e.newStatus(), "Order " + e.orderNumber() + " " + e.newStatus().toLowerCase());
            }
        });
    }
}
