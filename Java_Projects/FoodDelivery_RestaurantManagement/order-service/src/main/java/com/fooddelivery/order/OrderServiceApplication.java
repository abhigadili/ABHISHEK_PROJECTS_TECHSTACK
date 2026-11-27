package com.fooddelivery.order;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/** Entry point of the order-service (own Spring Boot application, own port, own database `food_order_db`). */
@SpringBootApplication(scanBasePackages = {"com.fooddelivery.order", "com.fooddelivery.common"})
@EntityScan({"com.fooddelivery.order", "com.fooddelivery.common.kafka.outbox"})
@EnableJpaRepositories({"com.fooddelivery.order", "com.fooddelivery.common.kafka.outbox"})
@EnableFeignClients(basePackages = "com.fooddelivery.order")
public class OrderServiceApplication {
    public static void main(String[] args) { SpringApplication.run(OrderServiceApplication.class, args); }
}
