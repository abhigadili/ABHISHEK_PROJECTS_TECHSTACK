package com.fooddelivery.payment.event;

import com.fooddelivery.common.kafka.EventConsumerSupport;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.kafka.Topics;
import com.fooddelivery.payment.service.PaymentService;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/** Consumer group "payment-service-group". */
@Component
public class PaymentEventConsumer {
    private final EventConsumerSupport support;
    private final PaymentService payments;

    public PaymentEventConsumer(EventConsumerSupport support, PaymentService payments) {
        this.support = support;
        this.payments = payments;
    }

    @KafkaListener(topics = Topics.ORDER_CREATED, groupId = "${spring.application.name}-group")
    public void onOrderCreated(ConsumerRecord<String, String> rec) {
        support.handle(rec, "PaymentEventConsumer", Events.OrderCreated.class, (env, e) -> payments.onOrderCreated(e));
    }

    @KafkaListener(topics = Topics.ORDER_CANCELLED, groupId = "${spring.application.name}-group")
    public void onOrderCancelled(ConsumerRecord<String, String> rec) {
        support.handle(rec, "PaymentEventConsumer", Events.OrderCancelled.class, (env, e) -> payments.onOrderVoided(e.orderId(), "Order cancelled: " + e.reason()));
    }

    @KafkaListener(topics = Topics.ORDER_REJECTED, groupId = "${spring.application.name}-group")
    public void onOrderRejected(ConsumerRecord<String, String> rec) {
        support.handle(rec, "PaymentEventConsumer", Events.OrderRejected.class, (env, e) -> payments.onOrderVoided(e.orderId(), "Order rejected: " + e.reason()));
    }
}
