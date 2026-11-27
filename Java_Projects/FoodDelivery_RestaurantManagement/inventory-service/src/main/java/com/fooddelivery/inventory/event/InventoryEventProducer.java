package com.fooddelivery.inventory.event;

import com.fooddelivery.common.kafka.EventProducer;
import com.fooddelivery.common.kafka.EventPublisher;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.kafka.Topics;
import com.fooddelivery.inventory.domain.Ingredient;
import org.springframework.stereotype.Component;

/** InventoryUpdatedEventProducer + LowStockEventProducer + reservation-failed (saga compensation trigger). */
@Component
@EventProducer(topics = {Topics.INVENTORY_UPDATED, Topics.INVENTORY_LOW_STOCK, Topics.INVENTORY_RESERVATION_FAILED})
public class InventoryEventProducer {
    private final EventPublisher publisher;

    public InventoryEventProducer(EventPublisher publisher) { this.publisher = publisher; }

    public void updated(Ingredient i, String reason) {
        publisher.publish(Topics.INVENTORY_UPDATED, "InventoryUpdated", String.valueOf(i.getRestaurantId()), String.valueOf(i.getRestaurantId()),
                new Events.InventoryUpdated(i.getId(), i.getRestaurantId(), i.getName(), i.getQuantity(), i.getUnit(), reason));
    }

    public void lowStock(Ingredient i, long ownerUserId) {
        publisher.publish(Topics.INVENTORY_LOW_STOCK, "LowStock", String.valueOf(i.getRestaurantId()), String.valueOf(i.getRestaurantId()),
                new Events.LowStock(i.getId(), i.getRestaurantId(), ownerUserId, i.getName(), i.getQuantity(), i.getLowStockThreshold(), i.getUnit()));
    }

    public void reservationFailed(long orderId, long restaurantId, String reason) {
        publisher.publish(Topics.INVENTORY_RESERVATION_FAILED, "InventoryReservationFailed", String.valueOf(orderId), String.valueOf(orderId),
                new Events.ReservationFailed(orderId, restaurantId, reason));
    }
}
