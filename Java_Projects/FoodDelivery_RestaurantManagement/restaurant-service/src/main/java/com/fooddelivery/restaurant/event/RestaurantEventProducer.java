package com.fooddelivery.restaurant.event;

import com.fooddelivery.common.kafka.EventProducer;
import com.fooddelivery.common.kafka.EventPublisher;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.kafka.Topics;
import com.fooddelivery.restaurant.domain.Restaurant;
import org.springframework.stereotype.Component;

/** RestaurantRegisteredEventProducer + RestaurantApprovedEventProducer (key = restaurant id). */
@Component
@EventProducer(topics = {Topics.RESTAURANT_REGISTERED, Topics.RESTAURANT_APPROVED})
public class RestaurantEventProducer {
    private final EventPublisher publisher;

    public RestaurantEventProducer(EventPublisher publisher) { this.publisher = publisher; }

    public void registered(Restaurant r) {
        publisher.publish(Topics.RESTAURANT_REGISTERED, "RestaurantRegistered", String.valueOf(r.getId()), String.valueOf(r.getId()),
                new Events.RestaurantRegistered(r.getId(), r.getOwnerUserId(), r.getName(), r.getCity(), String.join(",", r.getCuisines())));
    }

    public void approved(Restaurant r, String eventType) {
        publisher.publish(Topics.RESTAURANT_APPROVED, eventType, String.valueOf(r.getId()), String.valueOf(r.getId()),
                new Events.RestaurantApproved(r.getId(), r.getOwnerUserId(), r.getName(), r.getCity(), String.join(",", r.getCuisines()),
                        r.getAddressLine(), r.getLatitude(), r.getLongitude(), r.isOpen()));
    }
}
