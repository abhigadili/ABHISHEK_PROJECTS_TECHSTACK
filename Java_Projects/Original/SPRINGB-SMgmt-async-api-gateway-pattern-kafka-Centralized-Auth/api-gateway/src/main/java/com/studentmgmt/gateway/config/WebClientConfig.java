package com.studentmgmt.gateway.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * One reactive WebClient pointed at student-service, used only by
 * StudentLoginClient during the login handshake. This is the single
 * synchronous HTTP call anywhere in this system — everything else the
 * gateway does is either local (JWT validation) or proxying.
 */
@Configuration
public class WebClientConfig {

    @Bean
    public WebClient studentServiceWebClient(@Value("${services.student.url}") String studentServiceUrl) {
        return WebClient.builder()
                .baseUrl(studentServiceUrl)
                .build();
    }
}
