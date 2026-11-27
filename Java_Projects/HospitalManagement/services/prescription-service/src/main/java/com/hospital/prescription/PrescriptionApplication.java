package com.hospital.prescription;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.cloud.openfeign.EnableFeignClients;

@SpringBootApplication(scanBasePackages = {"com.hospital.prescription", "com.hospital.common"})
@EntityScan({"com.hospital.prescription", "com.hospital.common.kafka"})
@EnableJpaRepositories({"com.hospital.prescription", "com.hospital.common.kafka"})
@EnableFeignClients(clients = com.hospital.common.client.PatientClient.class)
public class PrescriptionApplication {
    public static void main(String[] args) {
        SpringApplication.run(PrescriptionApplication.class, args);
    }
}
