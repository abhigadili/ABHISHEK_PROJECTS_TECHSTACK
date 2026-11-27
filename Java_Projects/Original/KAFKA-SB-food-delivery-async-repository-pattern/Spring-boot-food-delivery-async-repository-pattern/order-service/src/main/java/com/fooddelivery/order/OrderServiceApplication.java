package com.fooddelivery.order;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Owns OrderDB exclusively. Publishes OrderCreatedEvent to the 'order-events'
 * topic when a new order is placed, and asynchronously consumes both
 * 'payment-events' and 'delivery-events' to update order status and append
 * history. This service never makes or receives a synchronous call to/from
 * any other service — see config/KafkaConsumerConfig for how it tells two
 * different event shapes on two different topics apart.
 */
@SpringBootApplication
public class OrderServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(OrderServiceApplication.class, args);
    }
}
