package com.studentmgmt.enrollment.client;

import com.studentmgmt.enrollment.dto.StudentDto;
import com.studentmgmt.enrollment.exception.PeerServiceException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * Synchronous (blocking) HTTP client for student-service. Every call here
 * runs on the calling thread and returns only once student-service has
 * actually responded — that's the "synchronous communication" the system
 * requires between enrollment-service and its peers.
 */
@Component
public class StudentClient {

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public StudentClient(RestTemplate restTemplate,
                          @Value("${services.student.base-url}") String baseUrl) {
        this.restTemplate = restTemplate;
        this.baseUrl = baseUrl;
    }

    public boolean exists(Long studentId) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Boolean> response = restTemplate.getForObject(
                    baseUrl + "/api/students/{id}/exists", Map.class, studentId);
            return response != null && Boolean.TRUE.equals(response.get("exists"));
        } catch (RestClientException e) {
            throw new PeerServiceException("student-service",
                    "Unable to verify student " + studentId + ": " + e.getMessage());
        }
    }

    public StudentDto getStudent(Long studentId) {
        try {
            return restTemplate.getForObject(baseUrl + "/api/students/{id}", StudentDto.class, studentId);
        } catch (RestClientException e) {
            throw new PeerServiceException("student-service",
                    "Unable to fetch student " + studentId + ": " + e.getMessage());
        }
    }
}
