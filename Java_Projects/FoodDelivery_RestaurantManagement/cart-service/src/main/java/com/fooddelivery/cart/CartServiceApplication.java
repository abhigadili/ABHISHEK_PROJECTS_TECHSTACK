package com.fooddelivery.cart;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/** Entry point of the cart-service (own Spring Boot application, own port, own database `food_cart_db`). */
@SpringBootApplication(scanBasePackages = {"com.fooddelivery.cart", "com.fooddelivery.common"})
@EntityScan({"com.fooddelivery.cart", "com.fooddelivery.common.kafka.outbox"})
@EnableJpaRepositories({"com.fooddelivery.cart", "com.fooddelivery.common.kafka.outbox"})
@EnableFeignClients(basePackages = "com.fooddelivery.cart")
public class CartServiceApplication {
    public static void main(String[] args) { SpringApplication.run(CartServiceApplication.class, args); }
}
