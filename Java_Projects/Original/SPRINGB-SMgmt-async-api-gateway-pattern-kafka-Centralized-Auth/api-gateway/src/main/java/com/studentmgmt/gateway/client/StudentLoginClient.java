package com.studentmgmt.gateway.client;

import com.studentmgmt.gateway.dto.VerifyCredentialsRequest;
import com.studentmgmt.gateway.dto.VerifyCredentialsResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

/**
 * Wraps the one synchronous-style call in this system: the gateway asks
 * student-service to verify a username/password during the login handshake.
 * It's "synchronous-style" from the caller's perspective but implemented
 * reactively (Mono), so it never blocks the gateway's Netty event loop.
 */
@Component
public class StudentLoginClient {

    private final WebClient studentServiceWebClient;

    public StudentLoginClient(WebClient studentServiceWebClient) {
        this.studentServiceWebClient = studentServiceWebClient;
    }

    public Mono<VerifyCredentialsResponse> verify(String username, String password) {
        return studentServiceWebClient.post()
                .uri("/api/student-logins/verify")
                .bodyValue(new VerifyCredentialsRequest(username, password))
                .retrieve()
                .bodyToMono(VerifyCredentialsResponse.class);
    }
}
