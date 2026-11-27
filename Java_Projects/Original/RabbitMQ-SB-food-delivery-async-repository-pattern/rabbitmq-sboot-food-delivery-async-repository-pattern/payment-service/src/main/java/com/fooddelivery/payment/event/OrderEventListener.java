package com.fooddelivery.payment.event;

import com.fooddelivery.payment.service.PaymentService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

/**
 * @RabbitListener methods run on Spring AMQP's own dedicated consumer
 * thread — not on the Netty event-loop threads WebFlux controllers use — so
 * calling .block() here to bridge into the reactive R2DBC pipeline below is
 * safe and does not starve the HTTP server. This is the standard, pragmatic
 * way to combine classic spring-rabbit listeners with a reactive downstream;
 * the fully non-blocking alternative would be Project Reactor's dedicated
 * "Reactor RabbitMQ" library, which trades this simplicity for an end-to-end
 * reactive consumer loop.
 */
@Component
public class OrderEventListener {

    private static final Logger log = LoggerFactory.getLogger(OrderEventListener.class);

    private final PaymentService paymentService;

    public OrderEventListener(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @RabbitListener(queues = "${rabbitmq.queue.order-events}")
    public void onOrderCreated(OrderCreatedEvent event) {
        log.info("Received OrderCreatedEvent for order {}", event.orderId());
        paymentService.processOrderPayment(event).block();
        log.info("Finished processing payment for order {}", event.orderId());
    }
}
