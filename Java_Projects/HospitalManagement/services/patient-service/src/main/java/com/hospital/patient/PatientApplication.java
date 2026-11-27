package com.hospital.patient;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;


@SpringBootApplication(scanBasePackages = {"com.hospital.patient", "com.hospital.common"})
@EntityScan({"com.hospital.patient", "com.hospital.common.kafka"})
@EnableJpaRepositories({"com.hospital.patient", "com.hospital.common.kafka"})

public class PatientApplication {
    public static void main(String[] args) {
        SpringApplication.run(PatientApplication.class, args);
    }
}
