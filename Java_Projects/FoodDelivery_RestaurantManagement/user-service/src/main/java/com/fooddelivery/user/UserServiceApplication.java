package com.fooddelivery.user;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/** Entry point of the user-service (own Spring Boot application, own port, own database `food_user_db`). */
@SpringBootApplication(scanBasePackages = {"com.fooddelivery.user", "com.fooddelivery.common"})
@EntityScan({"com.fooddelivery.user", "com.fooddelivery.common.kafka.outbox"})
@EnableJpaRepositories({"com.fooddelivery.user", "com.fooddelivery.common.kafka.outbox"})
@EnableFeignClients(basePackages = "com.fooddelivery.user")
public class UserServiceApplication {
    public static void main(String[] args) { SpringApplication.run(UserServiceApplication.class, args); }
}
