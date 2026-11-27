package com.fooddelivery.delivery.event;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
public class DeliveryEventProducer {

    private static final Logger log = LoggerFactory.getLogger(DeliveryEventProducer.class);

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final String deliveryEventsTopic;

    public DeliveryEventProducer(KafkaTemplate<String, Object> kafkaTemplate,
                                  @Value("${kafka.topic.delivery-events}") String deliveryEventsTopic) {
        this.kafkaTemplate = kafkaTemplate;
        this.deliveryEventsTopic = deliveryEventsTopic;
    }

    public void publish(DeliveryStatusUpdatedEvent event) {
        log.info("Publishing DeliveryStatusUpdatedEvent for order {} (status={})", event.orderId(), event.status());
        kafkaTemplate.send(deliveryEventsTopic, String.valueOf(event.orderId()), event);
    }
}
