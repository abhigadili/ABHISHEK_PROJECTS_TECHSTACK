package com.hospital.hospital;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;


@SpringBootApplication(scanBasePackages = {"com.hospital.hospital", "com.hospital.common"})
@EntityScan({"com.hospital.hospital", "com.hospital.common.kafka"})
@EnableJpaRepositories({"com.hospital.hospital", "com.hospital.common.kafka"})

public class HospitalApplication {
    public static void main(String[] args) {
        SpringApplication.run(HospitalApplication.class, args);
    }
}
