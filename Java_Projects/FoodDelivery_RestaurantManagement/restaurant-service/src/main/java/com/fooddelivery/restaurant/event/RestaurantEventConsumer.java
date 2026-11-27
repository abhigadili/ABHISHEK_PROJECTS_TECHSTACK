package com.fooddelivery.restaurant.event;

import com.fooddelivery.common.kafka.EventConsumerSupport;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.kafka.Topics;
import com.fooddelivery.restaurant.service.InboxService;
import com.fooddelivery.restaurant.service.RestaurantService;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/** Consumer group "restaurant-service-group": the restaurant's order inbox and its rating aggregate. */
@Component
public class RestaurantEventConsumer {
    private final EventConsumerSupport support;
    private final InboxService inbox;
    private final RestaurantService restaurants;

    public RestaurantEventConsumer(EventConsumerSupport support, InboxService inbox, RestaurantService restaurants) {
        this.support = support;
        this.inbox = inbox;
        this.restaurants = restaurants;
    }

    @KafkaListener(topics = Topics.ORDER_CONFIRMED, groupId = "${spring.application.name}-group")
    public void onOrderConfirmed(ConsumerRecord<String, String> rec) {
        support.handle(rec, "RestaurantEventConsumer", Events.OrderConfirmed.class, (env, e) -> inbox.onOrderConfirmed(e));
    }

    @KafkaListener(topics = Topics.ORDER_STATUS_UPDATED, groupId = "${spring.application.name}-group")
    public void onOrderStatus(ConsumerRecord<String, String> rec) {
        support.handle(rec, "RestaurantEventConsumer", Events.OrderStatusUpdated.class, (env, e) -> inbox.onStatus(e));
    }

    @KafkaListener(topics = Topics.REVIEW_CREATED, groupId = "${spring.application.name}-group")
    public void onReview(ConsumerRecord<String, String> rec) {
        support.handle(rec, "RestaurantEventConsumer", Events.ReviewCreated.class,
                (env, e) -> restaurants.applyRating(e.restaurantId(), e.restaurantAvgRating(), e.restaurantRatingCount()));
    }
}
