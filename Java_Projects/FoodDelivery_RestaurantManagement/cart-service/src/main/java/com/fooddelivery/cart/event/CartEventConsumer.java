package com.fooddelivery.cart.event;

import com.fooddelivery.cart.service.CartService;
import com.fooddelivery.common.kafka.EventConsumerSupport;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.kafka.Topics;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/** Consumer group "cart-service-group": an order was placed, so the cart that produced it is emptied. */
@Component
public class CartEventConsumer {
    private final EventConsumerSupport support;
    private final CartService carts;

    public CartEventConsumer(EventConsumerSupport support, CartService carts) {
        this.support = support;
        this.carts = carts;
    }

    @KafkaListener(topics = Topics.ORDER_CREATED, groupId = "${spring.application.name}-group")
    public void onOrderCreated(ConsumerRecord<String, String> rec) {
        support.handle(rec, "CartEventConsumer", Events.OrderCreated.class, (env, e) -> carts.clearForCustomer(e.customerId(), e.restaurantId()));
    }
}
