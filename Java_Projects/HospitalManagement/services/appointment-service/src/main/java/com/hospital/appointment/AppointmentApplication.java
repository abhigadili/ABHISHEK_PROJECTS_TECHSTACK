package com.hospital.appointment;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.cloud.openfeign.EnableFeignClients;

@SpringBootApplication(scanBasePackages = {"com.hospital.appointment", "com.hospital.common"})
@EntityScan({"com.hospital.appointment", "com.hospital.common.kafka"})
@EnableJpaRepositories({"com.hospital.appointment", "com.hospital.common.kafka"})
@EnableFeignClients(clients = com.hospital.common.client.PatientClient.class)
public class AppointmentApplication {
    public static void main(String[] args) {
        SpringApplication.run(AppointmentApplication.class, args);
    }
}
