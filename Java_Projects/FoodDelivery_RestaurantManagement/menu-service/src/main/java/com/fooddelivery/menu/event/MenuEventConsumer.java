package com.fooddelivery.menu.event;

import com.fooddelivery.common.kafka.EventConsumerSupport;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.kafka.Topics;
import com.fooddelivery.menu.service.MenuService;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/** Consumer group "menu-service-group": counts ordered quantities to power "popular items". */
@Component
public class MenuEventConsumer {
    private final EventConsumerSupport support;
    private final MenuService menu;

    public MenuEventConsumer(EventConsumerSupport support, MenuService menu) {
        this.support = support;
        this.menu = menu;
    }

    @KafkaListener(topics = Topics.ORDER_CONFIRMED, groupId = "${spring.application.name}-group")
    public void onOrderConfirmed(ConsumerRecord<String, String> rec) {
        support.handle(rec, "MenuEventConsumer", Events.OrderConfirmed.class, (env, e) -> {
            e.items().forEach(l -> menu.addPopularity(e.restaurantId(), l.menuItemId(), l.quantity()));
        });
        menu.evictPopular();
    }
}
