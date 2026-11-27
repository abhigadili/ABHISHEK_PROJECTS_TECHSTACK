package com.fooddelivery.eventaudit;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/** Entry point of the event-audit-service (own Spring Boot application, own port, own database `food_event_audit_db`). */
@SpringBootApplication(scanBasePackages = {"com.fooddelivery.eventaudit", "com.fooddelivery.common"})
@EntityScan({"com.fooddelivery.eventaudit", "com.fooddelivery.common.kafka.outbox"})
@EnableJpaRepositories({"com.fooddelivery.eventaudit", "com.fooddelivery.common.kafka.outbox"})
@EnableFeignClients(basePackages = "com.fooddelivery.eventaudit")
public class EventAuditServiceApplication {
    public static void main(String[] args) { SpringApplication.run(EventAuditServiceApplication.class, args); }
}
