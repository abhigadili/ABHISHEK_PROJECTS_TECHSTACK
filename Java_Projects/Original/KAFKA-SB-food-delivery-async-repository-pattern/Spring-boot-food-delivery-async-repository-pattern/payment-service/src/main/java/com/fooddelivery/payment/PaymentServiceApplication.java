package com.fooddelivery.payment;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Owns PaymentDB exclusively. This service's only coupling to the rest of
 * the system is Kafka: it consumes OrderCreatedEvent from the 'order-events'
 * topic (published by order-service) and publishes PaymentCompletedEvent to
 * the 'payment-events' topic. It never receives or makes a synchronous REST
 * call to or from any other service in this system.
 *
 * Spring Boot auto-configures Kafka listener processing as soon as
 * spring-kafka is on the classpath and a @KafkaListener method exists —
 * no explicit @EnableKafka annotation is required here.
 */
@SpringBootApplication
public class PaymentServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(PaymentServiceApplication.class, args);
    }
}
