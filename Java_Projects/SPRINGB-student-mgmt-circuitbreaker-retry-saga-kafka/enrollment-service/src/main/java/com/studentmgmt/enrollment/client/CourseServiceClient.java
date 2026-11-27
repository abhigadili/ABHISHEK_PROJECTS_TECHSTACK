package com.studentmgmt.enrollment.client;

import com.studentmgmt.enrollment.dto.CourseSummary;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

/**
 * CIRCUIT BREAKER PATTERN — mirrors StudentServiceClient exactly, but with
 * its OWN circuit breaker instance ("courseServiceClient"). This matters:
 * course-service being down should trip ONLY this breaker, not the one
 * guarding student-service — the two dependencies fail independently in
 * reality, so their circuit breakers must be independent too.
 */
@Component
public class CourseServiceClient {

    private static final Logger log = LoggerFactory.getLogger(CourseServiceClient.class);

    private final RestTemplate restTemplate;
    private final String courseServiceUrl;

    public CourseServiceClient(RestTemplate restTemplate,
                                @Value("${services.course.url}") String courseServiceUrl) {
        this.restTemplate = restTemplate;
        this.courseServiceUrl = courseServiceUrl;
    }

    @CircuitBreaker(name = "courseServiceClient", fallbackMethod = "getCourseFallback")
    public CourseSummary getCourse(Long courseId) {
        return restTemplate.getForObject(courseServiceUrl + "/api/courses/{id}", CourseSummary.class, courseId);
    }

    @SuppressWarnings("unused")
    private CourseSummary getCourseFallback(Long courseId, Throwable t) {
        log.warn("Circuit breaker fallback: course-service unavailable for courseId={} ({})", courseId, t.toString());
        return CourseSummary.fallback(courseId);
    }
}
