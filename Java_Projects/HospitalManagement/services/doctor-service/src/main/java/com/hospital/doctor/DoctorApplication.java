package com.hospital.doctor;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.cloud.openfeign.EnableFeignClients;

@SpringBootApplication(scanBasePackages = {"com.hospital.doctor", "com.hospital.common"})
@EntityScan({"com.hospital.doctor", "com.hospital.common.kafka"})
@EnableJpaRepositories({"com.hospital.doctor", "com.hospital.common.kafka"})
@EnableFeignClients(basePackages = "com.hospital.doctor")
public class DoctorApplication {
    public static void main(String[] args) {
        SpringApplication.run(DoctorApplication.class, args);
    }
}
