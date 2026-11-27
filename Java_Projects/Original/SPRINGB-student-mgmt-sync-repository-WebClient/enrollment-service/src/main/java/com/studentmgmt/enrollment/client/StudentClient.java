package com.studentmgmt.enrollment.client;

import com.studentmgmt.enrollment.dto.StudentDto;
import com.studentmgmt.enrollment.exception.PeerServiceException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientException;

import java.util.Map;

/**
 * WebClient is a non-blocking, reactive HTTP client by design — a call like
 * .retrieve().bodyToMono(X.class) returns immediately with a Mono that hasn't
 * necessarily resolved yet. Every method below ends its chain with .block(),
 * which parks the calling thread until that Mono completes (or errors) —
 * that .block() call is what makes this client behave exactly like
 * RestTemplate from the caller's point of view: synchronous, blocking,
 * "call it and get the real answer back."
 */
@Component
public class StudentClient {

    private final WebClient webClient;

    public StudentClient(WebClient.Builder webClientBuilder,
                          @Value("${services.student.base-url}") String baseUrl) {
        this.webClient = webClientBuilder.baseUrl(baseUrl).build();
    }

    public boolean exists(Long studentId) {
        try {
            Map<String, Boolean> response = webClient.get()
                    .uri("/api/students/{id}/exists", studentId)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
            return response != null && Boolean.TRUE.equals(response.get("exists"));
        } catch (WebClientException e) {
            throw new PeerServiceException("student-service",
                    "Unable to verify student " + studentId + ": " + e.getMessage());
        }
    }

    public StudentDto getStudent(Long studentId) {
        try {
            return webClient.get()
                    .uri("/api/students/{id}", studentId)
                    .retrieve()
                    .bodyToMono(StudentDto.class)
                    .block();
        } catch (WebClientException e) {
            throw new PeerServiceException("student-service",
                    "Unable to fetch student " + studentId + ": " + e.getMessage());
        }
    }
}
