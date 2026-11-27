package com.fooddelivery.review.event;

import com.fooddelivery.common.kafka.EventProducer;
import com.fooddelivery.common.kafka.EventPublisher;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.kafka.Topics;
import com.fooddelivery.review.domain.Review;
import org.springframework.stereotype.Component;

/** Publishes the review plus FRESH aggregates (key = restaurant id, so aggregate updates are applied in order). */
@Component
@EventProducer(topics = Topics.REVIEW_CREATED)
public class ReviewEventProducer {
    private final EventPublisher publisher;

    public ReviewEventProducer(EventPublisher publisher) { this.publisher = publisher; }

    public void publish(String eventType, Review r, double restAvg, long restCount, Double partnerAvg, Long partnerCount) {
        publisher.publish(Topics.REVIEW_CREATED, eventType, String.valueOf(r.getId()), String.valueOf(r.getRestaurantId()),
                new Events.ReviewCreated(r.getId(), r.getOrderId(), r.getCustomerId(), r.getRestaurantId(), r.getDeliveryPartnerId(), r.getRestaurantRating(),
                        r.getDeliveryRating(), restAvg, restCount, partnerAvg, partnerCount));
    }
}
