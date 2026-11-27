package com.fooddelivery.delivery;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Owns DeliveryDB exclusively. This service's only coupling to the rest of
 * the system is RabbitMQ: it consumes PaymentCompletedEvent from the
 * 'payment-events.exchange' (published by payment-service) and publishes
 * DeliveryStatusUpdatedEvent to the 'delivery-events.exchange'. It never
 * receives or makes a synchronous REST call to or from any other service.
 */
@SpringBootApplication
public class DeliveryServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(DeliveryServiceApplication.class, args);
    }
}
