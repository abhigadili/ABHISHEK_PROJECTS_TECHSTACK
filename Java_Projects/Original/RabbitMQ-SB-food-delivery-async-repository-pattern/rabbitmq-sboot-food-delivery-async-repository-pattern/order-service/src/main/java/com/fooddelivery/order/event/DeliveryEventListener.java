package com.fooddelivery.order.event;

import com.fooddelivery.order.service.OrderService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
public class DeliveryEventListener {

    private static final Logger log = LoggerFactory.getLogger(DeliveryEventListener.class);

    private final OrderService orderService;

    public DeliveryEventListener(OrderService orderService) {
        this.orderService = orderService;
    }

    @RabbitListener(queues = "${rabbitmq.queue.delivery-events}", containerFactory = "deliveryEventsContainerFactory")
    public void onDeliveryStatusUpdated(DeliveryStatusUpdatedEvent event) {
        log.info("Received DeliveryStatusUpdatedEvent for order {} (status={})", event.orderId(), event.status());
        orderService.applyDeliveryStatus(event).block();
        log.info("Order {} updated from delivery status", event.orderId());
    }
}
