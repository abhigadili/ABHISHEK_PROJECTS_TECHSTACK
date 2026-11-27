package com.fooddelivery.restaurant;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Owns RestaurantDB exclusively. This service is a pure catalog service —
 * it has no RabbitMQ producers or consumers, because no other service in
 * this system needs to react asynchronously to menu/catalog changes. Every
 * database call in this service goes through Spring Data R2DBC
 * (ReactiveCrudRepository), a non-blocking driver that is neither JPA,
 * Hibernate, nor JDBC-based.
 */
@SpringBootApplication
public class RestaurantServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(RestaurantServiceApplication.class, args);
    }
}
