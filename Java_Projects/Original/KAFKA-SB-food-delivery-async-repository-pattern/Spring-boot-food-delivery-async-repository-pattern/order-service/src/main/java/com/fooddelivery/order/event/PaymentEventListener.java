package com.fooddelivery.order.event;

import com.fooddelivery.order.service.OrderService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/** See payment-service's OrderEventListener for why .block() here is safe. */
@Component
public class PaymentEventListener {

    private static final Logger log = LoggerFactory.getLogger(PaymentEventListener.class);

    private final OrderService orderService;

    public PaymentEventListener(OrderService orderService) {
        this.orderService = orderService;
    }

    @KafkaListener(
            topics = "${kafka.topic.payment-events}",
            groupId = "${spring.kafka.consumer.group-id}",
            containerFactory = "paymentEventsContainerFactory")
    public void onPaymentCompleted(PaymentCompletedEvent event) {
        log.info("Received PaymentCompletedEvent for order {} (status={})", event.orderId(), event.status());
        orderService.applyPaymentResult(event).block();
        log.info("Order {} updated from payment result", event.orderId());
    }
}
