package com.fooddelivery.search;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/** Entry point of the search-service (own Spring Boot application, own port, own database `food_search_db`). */
@SpringBootApplication(scanBasePackages = {"com.fooddelivery.search", "com.fooddelivery.common"})
@EntityScan({"com.fooddelivery.search", "com.fooddelivery.common.kafka.outbox"})
@EnableJpaRepositories({"com.fooddelivery.search", "com.fooddelivery.common.kafka.outbox"})
@EnableFeignClients(basePackages = "com.fooddelivery.search")
public class SearchServiceApplication {
    public static void main(String[] args) { SpringApplication.run(SearchServiceApplication.class, args); }
}
