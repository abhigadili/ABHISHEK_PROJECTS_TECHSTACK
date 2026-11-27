package com.hospital.common.client;

import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.ExchangeFilterFunction;
import org.springframework.web.reactive.function.client.WebClient;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospital.common.security.CurrentUser;

import io.netty.channel.ChannelOption;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;

/** Builds the reusable WebClient instances: connect/response timeouts, JWT propagation, error mapping. */
@Component
@ConditionalOnClass(WebClient.class)
public class WebClientFactory {
    private final ObjectMapper mapper;
    private final int connectTimeoutMs;
    private final Duration responseTimeout;

    public WebClientFactory(ObjectMapper mapper,
                            @Value("${hospital.webclient.connect-timeout-ms:2000}") int connectTimeoutMs,
                            @Value("${hospital.webclient.response-timeout-ms:5000}") long responseTimeoutMs) {
        this.mapper = mapper;
        this.connectTimeoutMs = connectTimeoutMs;
        this.responseTimeout = Duration.ofMillis(responseTimeoutMs);
    }

    public Duration blockTimeout() {
        return responseTimeout.plusSeconds(1);
    }

    public WebClient create(String serviceName, String baseUrl) {
        HttpClient http = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, connectTimeoutMs)
                .responseTimeout(responseTimeout);
        return WebClient.builder()
                .baseUrl(baseUrl)
                .clientConnector(new ReactorClientHttpConnector(http))
                .filter(bearerPropagation())
                .filter(errorMapping(serviceName))
                .build();
    }

    private ExchangeFilterFunction bearerPropagation() {
        return (request, next) -> {
            String token = CurrentUser.token();
            return next.exchange(token == null ? request
                    : org.springframework.web.reactive.function.client.ClientRequest.from(request)
                        .header("Authorization", "Bearer " + token).build());
        };
    }

    private ExchangeFilterFunction errorMapping(String service) {
        return ExchangeFilterFunction.ofResponseProcessor(response -> {
            if (!response.statusCode().isError()) return Mono.just(response);
            int status = response.statusCode().value();
            return response.bodyToMono(String.class).defaultIfEmpty("")
                    .flatMap(body -> Mono.error(HttpErrors.map(mapper, service, status, body)));
        });
    }
}
