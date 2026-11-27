package com.fooddelivery.payment.event;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
public class PaymentEventProducer {

    private static final Logger log = LoggerFactory.getLogger(PaymentEventProducer.class);

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final String paymentEventsTopic;

    public PaymentEventProducer(KafkaTemplate<String, Object> kafkaTemplate,
                                 @Value("${kafka.topic.payment-events}") String paymentEventsTopic) {
        this.kafkaTemplate = kafkaTemplate;
        this.paymentEventsTopic = paymentEventsTopic;
    }

    public void publish(PaymentCompletedEvent event) {
        log.info("Publishing PaymentCompletedEvent for order {} (status={})", event.orderId(), event.status());
        kafkaTemplate.send(paymentEventsTopic, String.valueOf(event.orderId()), event);
    }
}
