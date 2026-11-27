package com.fooddelivery.delivery.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Delivery-assignment failure handling: unassigned jobs are retried and unanswered offers expire. */
@Component
public class AssignmentScheduler {
    private static final Logger log = LoggerFactory.getLogger(AssignmentScheduler.class);
    private final DeliveryService service;

    public AssignmentScheduler(DeliveryService service) { this.service = service; }

    @Scheduled(fixedDelayString = "${food.delivery.sweep-ms:10000}", initialDelay = 15000)
    public void sweep() {
        try { service.sweep(); } catch (Exception e) { log.warn("Assignment sweep failed: {}", e.getMessage()); }
    }
}
