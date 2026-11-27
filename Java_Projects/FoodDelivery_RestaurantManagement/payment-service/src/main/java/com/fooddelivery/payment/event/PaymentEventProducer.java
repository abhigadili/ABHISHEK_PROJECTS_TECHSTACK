package com.fooddelivery.payment.event;

import com.fooddelivery.common.kafka.EventProducer;
import com.fooddelivery.common.kafka.EventPublisher;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.kafka.Topics;
import com.fooddelivery.payment.domain.Payment;
import com.fooddelivery.payment.domain.Refund;
import org.springframework.stereotype.Component;

/** PaymentInitiated / PaymentSuccess / PaymentFailed / RefundInitiated / RefundCompleted. Key = order id. */
@Component
@EventProducer(topics = {Topics.PAYMENT_INITIATED, Topics.PAYMENT_SUCCESS, Topics.PAYMENT_FAILED, Topics.REFUND_INITIATED, Topics.REFUND_COMPLETED})
public class PaymentEventProducer {
    private final EventPublisher publisher;

    public PaymentEventProducer(EventPublisher publisher) { this.publisher = publisher; }

    private void send(String topic, String type, long orderId, Object payload) {
        publisher.publish(topic, type, String.valueOf(orderId), String.valueOf(orderId), payload);
    }

    public void initiated(Payment p) {
        send(Topics.PAYMENT_INITIATED, "PaymentInitiated", p.getOrderId(), new Events.PaymentInitiated(p.getId(), p.getOrderId(), p.getCustomerId(), p.getAmount(), p.getMethod(), p.getProvider()));
    }

    public void success(Payment p) {
        send(Topics.PAYMENT_SUCCESS, "PaymentSuccess", p.getOrderId(), new Events.PaymentSuccess(p.getId(), p.getOrderId(), p.getCustomerId(), p.getAmount(), p.getProviderRef(), p.getProvider()));
    }

    public void failed(Payment p, String reason) {
        send(Topics.PAYMENT_FAILED, "PaymentFailed", p.getOrderId(), new Events.PaymentFailed(p.getId(), p.getOrderId(), p.getCustomerId(), p.getAmount(), reason));
    }

    public void refundInitiated(Refund r, Payment p) {
        send(Topics.REFUND_INITIATED, "RefundInitiated", r.getOrderId(), new Events.RefundInitiated(r.getId(), p.getId(), r.getOrderId(), p.getCustomerId(), r.getAmount(), r.getReason()));
    }

    public void refundCompleted(Refund r, Payment p) {
        send(Topics.REFUND_COMPLETED, "RefundCompleted", r.getOrderId(), new Events.RefundCompleted(r.getId(), p.getId(), r.getOrderId(), p.getCustomerId(), r.getAmount(),
                r.getStatus().name(), r.getStatus() == Refund.Status.FAILED ? r.getFailureReason() : r.getReason()));
    }
}
