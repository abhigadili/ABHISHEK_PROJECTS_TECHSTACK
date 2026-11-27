package com.studentmgmt.enrollment;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Owns EnrollmentDB exclusively. This is the one service in the system that
 * talks to its peers over the network: before creating an Enrollment it
 * synchronously calls student-service and course-service to confirm the
 * referenced ids exist, and after a successful Payment it synchronously
 * calls notification-service to trigger a confirmation notification.
 *
 * All three calls use RestTemplate — a blocking, synchronous HTTP client —
 * because the prompt for this system explicitly calls for synchronous-only
 * communication between services (see the README for why RestTemplate over
 * WebClient/OpenFeign here).
 */
@SpringBootApplication
public class EnrollmentServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(EnrollmentServiceApplication.class, args);
    }
}
