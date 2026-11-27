package com.fooddelivery.menu.event;

import com.fooddelivery.common.kafka.EventProducer;
import com.fooddelivery.common.kafka.EventPublisher;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.kafka.Topics;
import com.fooddelivery.menu.domain.MenuItem;
import org.springframework.stereotype.Component;

/** MenuItemCreatedEventProducer + MenuItemUpdatedEventProducer (key = menu item id). */
@Component
@EventProducer(topics = {Topics.MENU_ITEM_CREATED, Topics.MENU_ITEM_UPDATED})
public class MenuEventProducer {
    private final EventPublisher publisher;

    public MenuEventProducer(EventPublisher publisher) { this.publisher = publisher; }

    public void created(MenuItem i) { send(Topics.MENU_ITEM_CREATED, "MenuItemCreated", i); }
    public void updated(MenuItem i) { send(Topics.MENU_ITEM_UPDATED, "MenuItemUpdated", i); }

    private void send(String topic, String type, MenuItem i) {
        publisher.publish(topic, type, String.valueOf(i.getId()), String.valueOf(i.getId()),
                new Events.MenuItemEvent(i.getId(), i.getRestaurantId(), i.getName(), i.getDescription(), i.getCategory().getName(),
                        i.getBasePrice(), i.isVegetarian(), i.isAvailable() && i.isActive(), i.getImageUrl()));
    }
}
