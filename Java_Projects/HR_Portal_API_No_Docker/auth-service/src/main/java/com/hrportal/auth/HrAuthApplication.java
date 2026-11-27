package com.hrportal.auth;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableAsync;

/** hr-auth-service: bootstrap. Scans its own package plus the reusable technical components of the common library. */
@SpringBootApplication(scanBasePackages = "com.hrportal")
@EntityScan("com.hrportal")
@EnableJpaRepositories(basePackages = "com.hrportal", considerNestedRepositories = true)
@EnableFeignClients(basePackages = "com.hrportal.auth")
@EnableAsync
public class HrAuthApplication {
    public static void main(String[] args) {
        SpringApplication.run(HrAuthApplication.class, args);
    }
}
