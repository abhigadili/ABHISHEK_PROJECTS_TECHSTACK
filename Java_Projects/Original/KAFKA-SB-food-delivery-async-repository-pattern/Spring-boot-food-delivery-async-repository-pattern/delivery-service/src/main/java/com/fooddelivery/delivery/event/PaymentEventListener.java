package com.fooddelivery.delivery.event;

import com.fooddelivery.delivery.service.DeliveryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/** See payment-service's OrderEventListener for why .block() here is safe. */
@Component
public class PaymentEventListener {

    private static final Logger log = LoggerFactory.getLogger(PaymentEventListener.class);

    private final DeliveryService deliveryService;

    public PaymentEventListener(DeliveryService deliveryService) {
        this.deliveryService = deliveryService;
    }

    @KafkaListener(topics = "${kafka.topic.payment-events}", groupId = "${spring.kafka.consumer.group-id}")
    public void onPaymentCompleted(PaymentCompletedEvent event) {
        log.info("Received PaymentCompletedEvent for order {} (status={})", event.orderId(), event.status());
        deliveryService.processPaymentCompleted(event).block();
        log.info("Finished processing delivery assignment for order {}", event.orderId());
    }
}
