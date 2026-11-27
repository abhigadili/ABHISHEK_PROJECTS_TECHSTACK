package com.fooddelivery.payment.event;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class PaymentEventProducer {

    private static final Logger log = LoggerFactory.getLogger(PaymentEventProducer.class);

    private final RabbitTemplate rabbitTemplate;
    private final String paymentEventsExchange;
    private final String paymentEventsRoutingKey;

    public PaymentEventProducer(RabbitTemplate rabbitTemplate,
                                 @Value("${rabbitmq.exchange.payment-events}") String paymentEventsExchange,
                                 @Value("${rabbitmq.routing-key.payment-events}") String paymentEventsRoutingKey) {
        this.rabbitTemplate = rabbitTemplate;
        this.paymentEventsExchange = paymentEventsExchange;
        this.paymentEventsRoutingKey = paymentEventsRoutingKey;
    }

    public void publish(PaymentCompletedEvent event) {
        log.info("Publishing PaymentCompletedEvent for order {} (status={})", event.orderId(), event.status());
        rabbitTemplate.convertAndSend(paymentEventsExchange, paymentEventsRoutingKey, event);
    }
}
