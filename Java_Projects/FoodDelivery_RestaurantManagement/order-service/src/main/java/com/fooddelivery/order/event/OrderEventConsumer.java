package com.fooddelivery.order.event;

import com.fooddelivery.common.kafka.EventConsumerSupport;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.kafka.Topics;
import com.fooddelivery.order.service.OrderWorkflowService;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/** Consumer group "order-service-group": the Saga participants' answers drive the order forward. */
@Component
public class OrderEventConsumer {
    private final EventConsumerSupport support;
    private final OrderWorkflowService workflow;

    public OrderEventConsumer(EventConsumerSupport support, OrderWorkflowService workflow) {
        this.support = support;
        this.workflow = workflow;
    }

    @KafkaListener(topics = Topics.PAYMENT_SUCCESS, groupId = "${spring.application.name}-group")
    public void onPaymentSuccess(ConsumerRecord<String, String> rec) {
        support.handle(rec, "OrderEventConsumer", Events.PaymentSuccess.class, (env, e) -> workflow.onPaymentSuccess(e));
    }

    @KafkaListener(topics = Topics.PAYMENT_FAILED, groupId = "${spring.application.name}-group")
    public void onPaymentFailed(ConsumerRecord<String, String> rec) {
        support.handle(rec, "OrderEventConsumer", Events.PaymentFailed.class, (env, e) -> workflow.onPaymentFailed(e));
    }

    @KafkaListener(topics = Topics.INVENTORY_RESERVATION_FAILED, groupId = "${spring.application.name}-group")
    public void onReservationFailed(ConsumerRecord<String, String> rec) {
        support.handle(rec, "OrderEventConsumer", Events.ReservationFailed.class, (env, e) -> workflow.onReservationFailed(e));
    }

    @KafkaListener(topics = Topics.REFUND_INITIATED, groupId = "${spring.application.name}-group")
    public void onRefundInitiated(ConsumerRecord<String, String> rec) {
        support.handle(rec, "OrderEventConsumer", Events.RefundInitiated.class, (env, e) -> workflow.onRefundInitiated(e));
    }

    @KafkaListener(topics = Topics.REFUND_COMPLETED, groupId = "${spring.application.name}-group")
    public void onRefundCompleted(ConsumerRecord<String, String> rec) {
        support.handle(rec, "OrderEventConsumer", Events.RefundCompleted.class, (env, e) -> workflow.onRefundCompleted(e));
    }

    @KafkaListener(topics = Topics.DELIVERY_PICKED_UP, groupId = "${spring.application.name}-group")
    public void onPickedUp(ConsumerRecord<String, String> rec) {
        support.handle(rec, "OrderEventConsumer", Events.DeliveryPickedUp.class, (env, e) -> workflow.onDeliveryPickedUp(e));
    }

    @KafkaListener(topics = Topics.DELIVERY_COMPLETED, groupId = "${spring.application.name}-group")
    public void onDelivered(ConsumerRecord<String, String> rec) {
        support.handle(rec, "OrderEventConsumer", Events.DeliveryCompleted.class, (env, e) -> workflow.onDeliveryCompleted(e));
    }
}
