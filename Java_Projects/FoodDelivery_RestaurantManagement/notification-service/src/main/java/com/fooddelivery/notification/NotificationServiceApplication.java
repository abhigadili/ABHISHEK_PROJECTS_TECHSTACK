package com.fooddelivery.notification;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/** Entry point of the notification-service (own Spring Boot application, own port, own database `food_notification_db`). */
@SpringBootApplication(scanBasePackages = {"com.fooddelivery.notification", "com.fooddelivery.common"})
@EntityScan({"com.fooddelivery.notification", "com.fooddelivery.common.kafka.outbox"})
@EnableJpaRepositories({"com.fooddelivery.notification", "com.fooddelivery.common.kafka.outbox"})
@EnableFeignClients(basePackages = "com.fooddelivery.notification")
public class NotificationServiceApplication {
    public static void main(String[] args) { SpringApplication.run(NotificationServiceApplication.class, args); }
}
