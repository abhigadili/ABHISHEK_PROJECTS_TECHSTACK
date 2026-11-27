package com.fooddelivery.restaurant.service;

import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.restaurant.domain.InboxOrder;
import com.fooddelivery.restaurant.repository.InboxOrderRepository;
import com.fooddelivery.restaurant.web.Dtos;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Set;

/** Maintains the restaurant's local order inbox from Kafka events and derives the sales summary from it. */
@Service
public class InboxService {
    private static final Set<String> IN_PROGRESS = Set.of("CONFIRMED", "RESTAURANT_ACCEPTED", "PREPARING", "READY_FOR_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY");
    private final InboxOrderRepository inbox;
    private final RestaurantService restaurants;

    public InboxService(InboxOrderRepository inbox, RestaurantService restaurants) {
        this.inbox = inbox;
        this.restaurants = restaurants;
    }

    @Transactional
    public void onOrderConfirmed(Events.OrderConfirmed e) {
        if (inbox.findByOrderId(e.orderId()).isPresent()) return;
        InboxOrder o = new InboxOrder();
        o.setOrderId(e.orderId());
        o.setOrderNumber(e.orderNumber());
        o.setRestaurantId(e.restaurantId());
        o.setCustomerId(e.customerId());
        o.setTotalAmount(e.totalAmount());
        o.setStatus("CONFIRMED");
        inbox.save(o);
    }

    @Transactional
    public void onStatus(Events.OrderStatusUpdated e) {
        inbox.findByOrderId(e.orderId()).ifPresent(o -> {
            o.setStatus(e.newStatus());
            o.setUpdatedAt(Instant.now());
        });
    }

    @Transactional(readOnly = true)
    public Page<InboxOrder> list(Long restaurantId, int page, int size) {
        restaurants.owned(restaurantId);
        return inbox.findByRestaurantIdOrderByReceivedAtDesc(restaurantId, PageRequest.of(page, Math.min(size, 100)));
    }

    @Transactional(readOnly = true)
    public Dtos.SalesSummary sales(Long restaurantId) {
        restaurants.owned(restaurantId);
        long total = 0, delivered = 0, lost = 0, progress = 0;
        BigDecimal revenue = BigDecimal.ZERO;
        for (Object[] row : inbox.summarise(restaurantId)) {
            String st = (String) row[0];
            long n = (Long) row[1];
            total += n;
            if ("DELIVERED".equals(st)) { delivered += n; revenue = revenue.add((BigDecimal) row[2]); }
            else if (IN_PROGRESS.contains(st)) progress += n;
            else lost += n;
        }
        return new Dtos.SalesSummary(total, delivered, lost, progress, revenue);
    }
}
