package com.studentmgmt.enrollment.client;

import com.studentmgmt.enrollment.dto.CourseDto;
import com.studentmgmt.enrollment.exception.PeerServiceException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/** Synchronous (blocking) HTTP client for course-service. */
@Component
public class CourseClient {

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public CourseClient(RestTemplate restTemplate,
                         @Value("${services.course.base-url}") String baseUrl) {
        this.restTemplate = restTemplate;
        this.baseUrl = baseUrl;
    }

    public boolean exists(Long courseId) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Boolean> response = restTemplate.getForObject(
                    baseUrl + "/api/courses/{id}/exists", Map.class, courseId);
            return response != null && Boolean.TRUE.equals(response.get("exists"));
        } catch (RestClientException e) {
            throw new PeerServiceException("course-service",
                    "Unable to verify course " + courseId + ": " + e.getMessage());
        }
    }

    public CourseDto getCourse(Long courseId) {
        try {
            return restTemplate.getForObject(baseUrl + "/api/courses/{id}", CourseDto.class, courseId);
        } catch (RestClientException e) {
            throw new PeerServiceException("course-service",
                    "Unable to fetch course " + courseId + ": " + e.getMessage());
        }
    }
}
