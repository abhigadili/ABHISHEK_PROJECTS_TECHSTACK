package com.fooddelivery.common.http;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fooddelivery.common.exception.RemoteServiceException;
import com.fooddelivery.common.web.Correlation;
import feign.RequestInterceptor;
import feign.Response;
import feign.codec.ErrorDecoder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/** Global OpenFeign behaviour: auth + correlation propagation (interceptor) and a custom error decoder. */
@Configuration
public class FeignConfig {
    private static final Logger log = LoggerFactory.getLogger(FeignConfig.class);

    @Bean
    public RequestInterceptor propagationInterceptor(AuthPropagation auth) {
        return template -> {
            template.header("Authorization", auth.authorizationHeader());
            template.header(Correlation.HEADER, Correlation.currentOrNew());
            log.debug("Feign -> {} {}", template.method(), template.url());
        };
    }

    @Bean
    public ErrorDecoder remoteErrorDecoder(ObjectMapper mapper) {
        return (methodKey, response) -> decode(mapper, methodKey, response);
    }

    private RemoteServiceException decode(ObjectMapper mapper, String methodKey, Response response) {
        String service = methodKey.contains("#") ? methodKey.substring(0, methodKey.indexOf('#')) : methodKey;
        String message = "Remote call failed";
        try {
            if (response.body() != null) {
                String raw = new String(response.body().asInputStream().readAllBytes(), StandardCharsets.UTF_8);
                JsonNode n = mapper.readTree(raw);
                if (n != null && n.hasNonNull("message")) message = n.get("message").asText();
            }
        } catch (IOException ignored) { }
        return new RemoteServiceException(service, response.status(), message);
    }
}
