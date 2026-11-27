package com.fooddelivery.delivery.event;

import com.fooddelivery.common.kafka.EventConsumerSupport;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.kafka.Topics;
import com.fooddelivery.delivery.service.DeliveryService;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/** Consumer group "delivery-service-group". */
@Component
public class DeliveryEventConsumer {
    private final EventConsumerSupport support;
    private final DeliveryService deliveries;

    public DeliveryEventConsumer(EventConsumerSupport support, DeliveryService deliveries) {
        this.support = support;
        this.deliveries = deliveries;
    }

    @KafkaListener(topics = Topics.USER_REGISTERED, groupId = "${spring.application.name}-group")
    public void onUserRegistered(ConsumerRecord<String, String> rec) {
        support.handle(rec, "DeliveryEventConsumer", Events.UserRegistered.class, (env, e) -> {
            if ("DELIVERY_PARTNER".equals(e.role())) deliveries.onPartnerRegistered(e);
        });
    }

    /** Eligible order events: only READY_FOR_PICKUP creates a delivery job. */
    @KafkaListener(topics = Topics.ORDER_STATUS_UPDATED, groupId = "${spring.application.name}-group")
    public void onOrderStatus(ConsumerRecord<String, String> rec) {
        support.handle(rec, "DeliveryEventConsumer", Events.OrderStatusUpdated.class, (env, e) -> {
            if ("READY_FOR_PICKUP".equals(e.newStatus())) deliveries.onOrderReady(e);
        });
    }

    @KafkaListener(topics = Topics.REVIEW_CREATED, groupId = "${spring.application.name}-group")
    public void onReview(ConsumerRecord<String, String> rec) {
        support.handle(rec, "DeliveryEventConsumer", Events.ReviewCreated.class, (env, e) -> {
            if (e.deliveryPartnerId() != null && e.partnerAvgRating() != null && e.partnerRatingCount() != null) {
                deliveries.onPartnerRating(e.deliveryPartnerId(), e.partnerAvgRating(), e.partnerRatingCount());
            }
        });
    }
}
