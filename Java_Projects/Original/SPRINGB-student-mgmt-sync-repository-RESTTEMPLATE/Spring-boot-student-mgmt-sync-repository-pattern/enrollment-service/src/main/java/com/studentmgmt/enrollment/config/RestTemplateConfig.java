package com.studentmgmt.enrollment.config;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

/**
 * A single shared, blocking HTTP client for every synchronous call this
 * service makes to student-service, course-service and notification-service.
 * RestTemplate.getForObject/postForObject block the calling thread until the
 * peer responds — exactly the "synchronous communication" this system requires.
 */
@Configuration
public class RestTemplateConfig {

    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
                .connectTimeout(Duration.ofSeconds(3))
                .readTimeout(Duration.ofSeconds(5))
                .build();
    }
}
