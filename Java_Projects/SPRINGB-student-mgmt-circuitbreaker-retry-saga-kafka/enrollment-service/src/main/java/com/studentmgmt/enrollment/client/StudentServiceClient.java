package com.studentmgmt.enrollment.client;

import com.studentmgmt.enrollment.dto.StudentSummary;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

/**
 * CIRCUIT BREAKER PATTERN — the one plain synchronous HTTP call this
 * project makes from one backend service to another (as opposed to the
 * fully asynchronous Kafka Saga). getStudent() is annotated
 * `@CircuitBreaker`: Resilience4j counts recent successes/failures for the
 * "studentServiceClient" instance (configured in application.properties).
 *
 * - CLOSED (normal): every call actually hits student-service.
 * - Enough failures within the sliding window trips it OPEN: for the next
 *   `wait-duration-in-open-state`, calls are NOT attempted at all — Spring
 *   calls getStudentFallback() immediately, in microseconds, instead of
 *   waiting out a slow timeout again and again. This is the core benefit:
 *   protecting THIS service (and its threads) from a struggling dependency,
 *   not just protecting the caller from one slow response.
 * - After the wait duration, it goes HALF_OPEN and lets a few trial calls
 *   through to see if student-service has recovered, before deciding to
 *   go back to CLOSED or OPEN again.
 *
 * Watch these transitions live via GET /actuator/health (component
 * "circuitBreakers") or GET /actuator/circuitbreakerevents.
 */
@Component
public class StudentServiceClient {

    private static final Logger log = LoggerFactory.getLogger(StudentServiceClient.class);

    private final RestTemplate restTemplate;
    private final String studentServiceUrl;

    public StudentServiceClient(RestTemplate restTemplate,
                                 @Value("${services.student.url}") String studentServiceUrl) {
        this.restTemplate = restTemplate;
        this.studentServiceUrl = studentServiceUrl;
    }

    @CircuitBreaker(name = "studentServiceClient", fallbackMethod = "getStudentFallback")
    public StudentSummary getStudent(Long studentId) {
        return restTemplate.getForObject(studentServiceUrl + "/api/students/{id}", StudentSummary.class, studentId);
    }

    @SuppressWarnings("unused")
    private StudentSummary getStudentFallback(Long studentId, Throwable t) {
        log.warn("Circuit breaker fallback: student-service unavailable for studentId={} ({})", studentId, t.toString());
        return StudentSummary.fallback(studentId);
    }
}
