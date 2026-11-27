package com.fooddelivery.delivery.event;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class DeliveryEventProducer {

    private static final Logger log = LoggerFactory.getLogger(DeliveryEventProducer.class);

    private final RabbitTemplate rabbitTemplate;
    private final String deliveryEventsExchange;
    private final String deliveryEventsRoutingKey;

    public DeliveryEventProducer(RabbitTemplate rabbitTemplate,
                                  @Value("${rabbitmq.exchange.delivery-events}") String deliveryEventsExchange,
                                  @Value("${rabbitmq.routing-key.delivery-events}") String deliveryEventsRoutingKey) {
        this.rabbitTemplate = rabbitTemplate;
        this.deliveryEventsExchange = deliveryEventsExchange;
        this.deliveryEventsRoutingKey = deliveryEventsRoutingKey;
    }

    public void publish(DeliveryStatusUpdatedEvent event) {
        log.info("Publishing DeliveryStatusUpdatedEvent for order {} (status={})", event.orderId(), event.status());
        rabbitTemplate.convertAndSend(deliveryEventsExchange, deliveryEventsRoutingKey, event);
    }
}
