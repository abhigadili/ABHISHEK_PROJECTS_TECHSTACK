package com.fooddelivery.search.event;

import com.fooddelivery.common.kafka.EventConsumerSupport;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.kafka.Topics;
import com.fooddelivery.search.service.SearchService;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/** Consumer group "search-service-group": the search index follows the catalogue events. */
@Component
public class SearchEventConsumer {
    private static final String G = "${spring.application.name}-group";
    private final EventConsumerSupport support;
    private final SearchService search;

    public SearchEventConsumer(EventConsumerSupport support, SearchService search) {
        this.support = support;
        this.search = search;
    }

    @KafkaListener(topics = Topics.RESTAURANT_APPROVED, groupId = G)
    public void restaurant(ConsumerRecord<String, String> rec) {
        support.handle(rec, "SearchEventConsumer", Events.RestaurantApproved.class, (env, e) -> search.onRestaurantEvent(env.eventType(), e));
    }

    @KafkaListener(topics = Topics.MENU_ITEM_CREATED, groupId = G)
    public void itemCreated(ConsumerRecord<String, String> rec) {
        support.handle(rec, "SearchEventConsumer", Events.MenuItemEvent.class, (env, e) -> search.onMenuItem(e));
    }

    @KafkaListener(topics = Topics.MENU_ITEM_UPDATED, groupId = G)
    public void itemUpdated(ConsumerRecord<String, String> rec) {
        support.handle(rec, "SearchEventConsumer", Events.MenuItemEvent.class, (env, e) -> search.onMenuItem(e));
    }

    @KafkaListener(topics = Topics.REVIEW_CREATED, groupId = G)
    public void review(ConsumerRecord<String, String> rec) {
        support.handle(rec, "SearchEventConsumer", Events.ReviewCreated.class, (env, e) -> search.onRating(e.restaurantId(), e.restaurantAvgRating(), e.restaurantRatingCount()));
    }
}
