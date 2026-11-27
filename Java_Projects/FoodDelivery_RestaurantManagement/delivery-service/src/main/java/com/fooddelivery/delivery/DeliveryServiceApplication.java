package com.fooddelivery.delivery;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/** Entry point of the delivery-service (own Spring Boot application, own port, own database `food_delivery_db`). */
@SpringBootApplication(scanBasePackages = {"com.fooddelivery.delivery", "com.fooddelivery.common"})
@EntityScan({"com.fooddelivery.delivery", "com.fooddelivery.common.kafka.outbox"})
@EnableJpaRepositories({"com.fooddelivery.delivery", "com.fooddelivery.common.kafka.outbox"})
@EnableFeignClients(basePackages = "com.fooddelivery.delivery")
public class DeliveryServiceApplication {
    public static void main(String[] args) { SpringApplication.run(DeliveryServiceApplication.class, args); }
}
