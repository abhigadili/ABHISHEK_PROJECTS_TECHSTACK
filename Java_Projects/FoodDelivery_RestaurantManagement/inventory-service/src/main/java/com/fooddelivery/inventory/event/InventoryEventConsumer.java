package com.fooddelivery.inventory.event;

import com.fooddelivery.common.kafka.EventConsumerSupport;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.kafka.Topics;
import com.fooddelivery.inventory.service.InventoryService;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/** Consumer group "inventory-service-group": stock follows the order lifecycle. */
@Component
public class InventoryEventConsumer {
    private final EventConsumerSupport support;
    private final InventoryService inventory;

    public InventoryEventConsumer(EventConsumerSupport support, InventoryService inventory) {
        this.support = support;
        this.inventory = inventory;
    }

    @KafkaListener(topics = Topics.ORDER_CONFIRMED, groupId = "${spring.application.name}-group")
    public void onOrderConfirmed(ConsumerRecord<String, String> rec) {
        support.handle(rec, "InventoryEventConsumer", Events.OrderConfirmed.class, (env, e) -> inventory.consumeForOrder(e));
    }

    @KafkaListener(topics = Topics.ORDER_CANCELLED, groupId = "${spring.application.name}-group")
    public void onOrderCancelled(ConsumerRecord<String, String> rec) {
        support.handle(rec, "InventoryEventConsumer", Events.OrderCancelled.class, (env, e) -> inventory.returnForOrder(e.orderId()));
    }

    @KafkaListener(topics = Topics.ORDER_REJECTED, groupId = "${spring.application.name}-group")
    public void onOrderRejected(ConsumerRecord<String, String> rec) {
        support.handle(rec, "InventoryEventConsumer", Events.OrderRejected.class, (env, e) -> inventory.returnForOrder(e.orderId()));
    }
}
