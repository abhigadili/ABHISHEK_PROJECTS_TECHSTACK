package com.fooddelivery.delivery.event;

import com.fooddelivery.common.kafka.EventProducer;
import com.fooddelivery.common.kafka.EventPublisher;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.kafka.Topics;
import com.fooddelivery.delivery.domain.Delivery;
import org.springframework.stereotype.Component;

import java.time.Instant;

/** DeliveryAssigned / DeliveryAccepted / DeliveryPickedUp / DeliveryCompleted producers. Key = order id. */
@Component
@EventProducer(topics = {Topics.DELIVERY_ASSIGNED, Topics.DELIVERY_ACCEPTED, Topics.DELIVERY_PICKED_UP, Topics.DELIVERY_COMPLETED})
public class DeliveryEventProducer {
    private final EventPublisher publisher;

    public DeliveryEventProducer(EventPublisher publisher) { this.publisher = publisher; }

    private void send(String topic, String type, Delivery d, Object payload) {
        publisher.publish(topic, type, String.valueOf(d.getOrderId()), String.valueOf(d.getOrderId()), payload);
    }

    public void assigned(Delivery d) {
        send(Topics.DELIVERY_ASSIGNED, "DeliveryAssigned", d, new Events.DeliveryAssigned(d.getId(), d.getOrderId(), d.getPartnerUserId(), d.getCustomerId(), d.getPickupAddress(), d.getDeliveryAddress()));
    }
    public void accepted(Delivery d) {
        send(Topics.DELIVERY_ACCEPTED, "DeliveryAccepted", d, new Events.DeliveryAccepted(d.getId(), d.getOrderId(), d.getPartnerUserId(), d.getCustomerId()));
    }
    public void pickedUp(Delivery d) {
        send(Topics.DELIVERY_PICKED_UP, "DeliveryPickedUp", d, new Events.DeliveryPickedUp(d.getId(), d.getOrderId(), d.getPartnerUserId(), d.getCustomerId()));
    }
    public void completed(Delivery d) {
        send(Topics.DELIVERY_COMPLETED, "DeliveryCompleted", d, new Events.DeliveryCompleted(d.getId(), d.getOrderId(), d.getPartnerUserId(), d.getCustomerId(), d.getRestaurantId(), Instant.now()));
    }
}
