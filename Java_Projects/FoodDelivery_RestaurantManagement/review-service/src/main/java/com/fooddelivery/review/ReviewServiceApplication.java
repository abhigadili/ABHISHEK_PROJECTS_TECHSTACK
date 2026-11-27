package com.fooddelivery.review;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/** Entry point of the review-service (own Spring Boot application, own port, own database `food_review_db`). */
@SpringBootApplication(scanBasePackages = {"com.fooddelivery.review", "com.fooddelivery.common"})
@EntityScan({"com.fooddelivery.review", "com.fooddelivery.common.kafka.outbox"})
@EnableJpaRepositories({"com.fooddelivery.review", "com.fooddelivery.common.kafka.outbox"})
@EnableFeignClients(basePackages = "com.fooddelivery.review")
public class ReviewServiceApplication {
    public static void main(String[] args) { SpringApplication.run(ReviewServiceApplication.class, args); }
}
