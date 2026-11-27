package com.hospital.pharmacy;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.cloud.openfeign.EnableFeignClients;

@SpringBootApplication(scanBasePackages = {"com.hospital.pharmacy", "com.hospital.common"})
@EntityScan({"com.hospital.pharmacy", "com.hospital.common.kafka"})
@EnableJpaRepositories({"com.hospital.pharmacy", "com.hospital.common.kafka"})
@EnableFeignClients(basePackages = "com.hospital.pharmacy")
public class PharmacyApplication {
    public static void main(String[] args) {
        SpringApplication.run(PharmacyApplication.class, args);
    }
}
