package com.hospital.common.client;

import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospital.common.security.CurrentUser;

import feign.RequestInterceptor;
import feign.codec.ErrorDecoder;

/** Applies to every Feign client of a service: JWT propagation + HTTP error -> ApiException mapping. */
@Configuration
@ConditionalOnClass(name = "feign.Feign")
public class FeignCommonConfig {

    @Bean
    public RequestInterceptor bearerPropagation() {
        return template -> {
            String token = CurrentUser.token();
            if (token != null) template.header("Authorization", "Bearer " + token);
        };
    }

    @Bean
    public ErrorDecoder hospitalErrorDecoder(ObjectMapper mapper) {
        return (methodKey, response) -> {
            String body = null;
            try {
                if (response.body() != null) body = new String(response.body().asInputStream().readAllBytes());
            } catch (Exception ignored) {
                // body is only used to enrich the message
            }
            String service = methodKey.substring(0, methodKey.indexOf('#'));
            return HttpErrors.map(mapper, service, response.status(), body);
        };
    }
}
