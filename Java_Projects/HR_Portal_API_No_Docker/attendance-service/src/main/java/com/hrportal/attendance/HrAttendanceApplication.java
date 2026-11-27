package com.hrportal.attendance;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableAsync;

/** hr-attendance-service: bootstrap. Scans its own package plus the reusable technical components of the common library. */
@SpringBootApplication(scanBasePackages = "com.hrportal")
@EntityScan("com.hrportal")
@EnableJpaRepositories(basePackages = "com.hrportal", considerNestedRepositories = true)
@EnableFeignClients(basePackages = "com.hrportal.attendance")
@EnableAsync
public class HrAttendanceApplication {
    public static void main(String[] args) {
        SpringApplication.run(HrAttendanceApplication.class, args);
    }
}
