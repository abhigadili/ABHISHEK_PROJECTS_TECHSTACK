package com.fooddelivery.review.event;

import com.fooddelivery.common.kafka.EventConsumerSupport;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.kafka.Topics;
import com.fooddelivery.review.service.ReviewService;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/** Consumer group "review-service-group": delivered orders become reviewable. */
@Component
public class ReviewEventConsumer {
    private final EventConsumerSupport support;
    private final ReviewService reviews;

    public ReviewEventConsumer(EventConsumerSupport support, ReviewService reviews) {
        this.support = support;
        this.reviews = reviews;
    }

    @KafkaListener(topics = Topics.ORDER_CONFIRMED, groupId = "${spring.application.name}-group")
    public void onOrderConfirmed(ConsumerRecord<String, String> rec) {
        support.handle(rec, "ReviewEventConsumer", Events.OrderConfirmed.class, (env, e) -> reviews.onOrderConfirmed(e));
    }

    @KafkaListener(topics = Topics.DELIVERY_COMPLETED, groupId = "${spring.application.name}-group")
    public void onDeliveryCompleted(ConsumerRecord<String, String> rec) {
        support.handle(rec, "ReviewEventConsumer", Events.DeliveryCompleted.class, (env, e) -> reviews.onDeliveryCompleted(e));
    }
}
