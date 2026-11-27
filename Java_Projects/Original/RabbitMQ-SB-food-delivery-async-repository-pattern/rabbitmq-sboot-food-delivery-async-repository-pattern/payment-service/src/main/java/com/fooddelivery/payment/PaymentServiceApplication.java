package com.fooddelivery.payment;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Owns PaymentDB exclusively. This service's only coupling to the rest of
 * the system is RabbitMQ: it consumes OrderCreatedEvent from the
 * 'order-events.exchange' (published by order-service) and publishes
 * PaymentCompletedEvent to the 'payment-events.exchange'. It never receives
 * or makes a synchronous REST call to or from any other service in this
 * system.
 *
 * Spring Boot auto-configures RabbitMQ listener processing as soon as
 * spring-boot-starter-amqp is on the classpath and a @RabbitListener method
 * exists — no explicit @EnableRabbit annotation is required here.
 */
@SpringBootApplication
public class PaymentServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(PaymentServiceApplication.class, args);
    }
}
