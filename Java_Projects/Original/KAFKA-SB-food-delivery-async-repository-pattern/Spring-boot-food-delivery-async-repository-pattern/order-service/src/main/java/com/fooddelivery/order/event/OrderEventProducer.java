package com.fooddelivery.order.event;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
public class OrderEventProducer {

    private static final Logger log = LoggerFactory.getLogger(OrderEventProducer.class);

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final String orderEventsTopic;

    public OrderEventProducer(KafkaTemplate<String, Object> kafkaTemplate,
                               @Value("${kafka.topic.order-events}") String orderEventsTopic) {
        this.kafkaTemplate = kafkaTemplate;
        this.orderEventsTopic = orderEventsTopic;
    }

    public void publish(OrderCreatedEvent event) {
        log.info("Publishing OrderCreatedEvent for order {}", event.orderId());
        kafkaTemplate.send(orderEventsTopic, String.valueOf(event.orderId()), event);
    }
}
