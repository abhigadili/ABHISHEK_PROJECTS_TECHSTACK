package com.studentmgmt.enrollment.client;

import com.studentmgmt.enrollment.dto.CourseDto;
import com.studentmgmt.enrollment.exception.PeerServiceException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientException;

import java.util.Map;

/** WebClient client for course-service — see StudentClient for why every call ends in .block(). */
@Component
public class CourseClient {

    private final WebClient webClient;

    public CourseClient(WebClient.Builder webClientBuilder,
                         @Value("${services.course.base-url}") String baseUrl) {
        this.webClient = webClientBuilder.baseUrl(baseUrl).build();
    }

    public boolean exists(Long courseId) {
        try {
            Map<String, Boolean> response = webClient.get()
                    .uri("/api/courses/{id}/exists", courseId)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
            return response != null && Boolean.TRUE.equals(response.get("exists"));
        } catch (WebClientException e) {
            throw new PeerServiceException("course-service",
                    "Unable to verify course " + courseId + ": " + e.getMessage());
        }
    }

    public CourseDto getCourse(Long courseId) {
        try {
            return webClient.get()
                    .uri("/api/courses/{id}", courseId)
                    .retrieve()
                    .bodyToMono(CourseDto.class)
                    .block();
        } catch (WebClientException e) {
            throw new PeerServiceException("course-service",
                    "Unable to fetch course " + courseId + ": " + e.getMessage());
        }
    }
}
