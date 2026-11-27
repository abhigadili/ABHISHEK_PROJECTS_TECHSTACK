package com.fooddelivery.restaurant;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/** Entry point of the restaurant-service (own Spring Boot application, own port, own database `food_restaurant_db`). */
@SpringBootApplication(scanBasePackages = {"com.fooddelivery.restaurant", "com.fooddelivery.common"})
@EntityScan({"com.fooddelivery.restaurant", "com.fooddelivery.common.kafka.outbox"})
@EnableJpaRepositories({"com.fooddelivery.restaurant", "com.fooddelivery.common.kafka.outbox"})
@EnableFeignClients(basePackages = "com.fooddelivery.restaurant")
public class RestaurantServiceApplication {
    public static void main(String[] args) { SpringApplication.run(RestaurantServiceApplication.class, args); }
}
