package com.hrportal.exit;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableAsync;

/** hr-exit-service: bootstrap. Scans its own package plus the reusable technical components of the common library. */
@SpringBootApplication(scanBasePackages = "com.hrportal")
@EntityScan("com.hrportal")
@EnableJpaRepositories(basePackages = "com.hrportal", considerNestedRepositories = true)
@EnableFeignClients(basePackages = "com.hrportal.exit")
@EnableAsync
public class HrExitApplication {
    public static void main(String[] args) {
        SpringApplication.run(HrExitApplication.class, args);
    }
}
