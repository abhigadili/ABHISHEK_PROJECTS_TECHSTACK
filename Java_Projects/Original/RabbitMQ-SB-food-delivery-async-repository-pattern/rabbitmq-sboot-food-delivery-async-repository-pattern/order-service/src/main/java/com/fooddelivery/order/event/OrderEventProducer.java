package com.fooddelivery.order.event;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class OrderEventProducer {

    private static final Logger log = LoggerFactory.getLogger(OrderEventProducer.class);

    private final RabbitTemplate rabbitTemplate;
    private final String orderEventsExchange;
    private final String orderEventsRoutingKey;

    public OrderEventProducer(RabbitTemplate rabbitTemplate,
                               @Value("${rabbitmq.exchange.order-events}") String orderEventsExchange,
                               @Value("${rabbitmq.routing-key.order-events}") String orderEventsRoutingKey) {
        this.rabbitTemplate = rabbitTemplate;
        this.orderEventsExchange = orderEventsExchange;
        this.orderEventsRoutingKey = orderEventsRoutingKey;
    }

    public void publish(OrderCreatedEvent event) {
        log.info("Publishing OrderCreatedEvent for order {}", event.orderId());
        rabbitTemplate.convertAndSend(orderEventsExchange, orderEventsRoutingKey, event);
    }
}
