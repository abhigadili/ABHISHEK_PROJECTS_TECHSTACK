package com.fooddelivery.menu;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/** Entry point of the menu-service (own Spring Boot application, own port, own database `food_menu_db`). */
@SpringBootApplication(scanBasePackages = {"com.fooddelivery.menu", "com.fooddelivery.common"})
@EntityScan({"com.fooddelivery.menu", "com.fooddelivery.common.kafka.outbox"})
@EnableJpaRepositories({"com.fooddelivery.menu", "com.fooddelivery.common.kafka.outbox"})
@EnableFeignClients(basePackages = "com.fooddelivery.menu")
public class MenuServiceApplication {
    public static void main(String[] args) { SpringApplication.run(MenuServiceApplication.class, args); }
}
