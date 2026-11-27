package com.fooddelivery.payment;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/** Entry point of the payment-service (own Spring Boot application, own port, own database `food_payment_db`). */
@SpringBootApplication(scanBasePackages = {"com.fooddelivery.payment", "com.fooddelivery.common"})
@EntityScan({"com.fooddelivery.payment", "com.fooddelivery.common.kafka.outbox"})
@EnableJpaRepositories({"com.fooddelivery.payment", "com.fooddelivery.common.kafka.outbox"})
@EnableFeignClients(basePackages = "com.fooddelivery.payment")
public class PaymentServiceApplication {
    public static void main(String[] args) { SpringApplication.run(PaymentServiceApplication.class, args); }
}
