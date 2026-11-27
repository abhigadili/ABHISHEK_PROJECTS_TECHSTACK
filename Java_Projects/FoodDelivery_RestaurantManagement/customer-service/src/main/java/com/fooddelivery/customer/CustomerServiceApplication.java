package com.fooddelivery.customer;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/** Entry point of the customer-service (own Spring Boot application, own port, own database `food_customer_db`). */
@SpringBootApplication(scanBasePackages = {"com.fooddelivery.customer", "com.fooddelivery.common"})
@EntityScan({"com.fooddelivery.customer", "com.fooddelivery.common.kafka.outbox"})
@EnableJpaRepositories({"com.fooddelivery.customer", "com.fooddelivery.common.kafka.outbox"})
@EnableFeignClients(basePackages = "com.fooddelivery.customer")
public class CustomerServiceApplication {
    public static void main(String[] args) { SpringApplication.run(CustomerServiceApplication.class, args); }
}
