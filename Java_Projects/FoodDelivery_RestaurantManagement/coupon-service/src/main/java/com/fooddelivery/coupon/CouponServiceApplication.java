package com.fooddelivery.coupon;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/** Entry point of the coupon-service (own Spring Boot application, own port, own database `food_coupon_db`). */
@SpringBootApplication(scanBasePackages = {"com.fooddelivery.coupon", "com.fooddelivery.common"})
@EntityScan({"com.fooddelivery.coupon", "com.fooddelivery.common.kafka.outbox"})
@EnableJpaRepositories({"com.fooddelivery.coupon", "com.fooddelivery.common.kafka.outbox"})
@EnableFeignClients(basePackages = "com.fooddelivery.coupon")
public class CouponServiceApplication {
    public static void main(String[] args) { SpringApplication.run(CouponServiceApplication.class, args); }
}
