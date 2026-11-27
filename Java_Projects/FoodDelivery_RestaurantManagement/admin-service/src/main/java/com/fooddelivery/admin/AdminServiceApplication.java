package com.fooddelivery.admin;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/** Entry point of the admin-service (own Spring Boot application, own port, own database `food_admin_db`). */
@SpringBootApplication(scanBasePackages = {"com.fooddelivery.admin", "com.fooddelivery.common"})
@EntityScan({"com.fooddelivery.admin", "com.fooddelivery.common.kafka.outbox"})
@EnableJpaRepositories({"com.fooddelivery.admin", "com.fooddelivery.common.kafka.outbox"})
@EnableFeignClients(basePackages = "com.fooddelivery.admin")
public class AdminServiceApplication {
    public static void main(String[] args) { SpringApplication.run(AdminServiceApplication.class, args); }
}
