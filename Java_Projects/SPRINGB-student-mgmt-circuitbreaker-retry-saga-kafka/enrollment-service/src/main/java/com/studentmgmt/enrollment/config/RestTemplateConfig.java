package com.studentmgmt.enrollment.config;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

/**
 * Short, deliberate timeouts are what make the Circuit Breaker demo actually
 * work: if student-service/course-service is down or unreachable, a call
 * with NO timeout could hang for a very long time (OS-level TCP timeout),
 * during which the circuit breaker never even sees a failure to count. A 2s
 * connect / 2s read timeout means a dead dependency fails fast and
 * predictably, so CircuitBreakerConfig's failure-rate-threshold can actually
 * trip within a demo-able number of calls.
 */
@Configuration
public class RestTemplateConfig {

    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
                .connectTimeout(Duration.ofSeconds(2))
                .readTimeout(Duration.ofSeconds(2))
                .build();
    }
}
