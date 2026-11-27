package com.studentmgmt.enrollment.client;

import com.studentmgmt.enrollment.dto.CourseDto;
import com.studentmgmt.enrollment.exception.PeerServiceException;
import feign.FeignException;
import org.springframework.stereotype.Component;

import java.util.Map;

/** Thin wrapper around CourseFeignClient, translating Feign exceptions to PeerServiceException. */
@Component
public class CourseClient {

    private final CourseFeignClient courseFeignClient;

    public CourseClient(CourseFeignClient courseFeignClient) {
        this.courseFeignClient = courseFeignClient;
    }

    public boolean exists(Long courseId) {
        try {
            Map<String, Boolean> response = courseFeignClient.exists(courseId);
            return response != null && Boolean.TRUE.equals(response.get("exists"));
        } catch (FeignException e) {
            throw new PeerServiceException("course-service",
                    "Unable to verify course " + courseId + ": " + e.getMessage());
        }
    }

    public CourseDto getCourse(Long courseId) {
        try {
            return courseFeignClient.getCourse(courseId);
        } catch (FeignException e) {
            throw new PeerServiceException("course-service",
                    "Unable to fetch course " + courseId + ": " + e.getMessage());
        }
    }
}
