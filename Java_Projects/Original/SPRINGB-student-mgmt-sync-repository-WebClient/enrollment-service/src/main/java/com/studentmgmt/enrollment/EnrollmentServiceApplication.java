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
 * All three calls use WebClient, terminated with .block() in the client/
 * classes — WebClient is non-blocking by design, but .block() parks the
 * calling thread until the peer responds, which is what keeps every call
 * in this service synchronous, as this system requires.
 */
@SpringBootApplication
public class EnrollmentServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(EnrollmentServiceApplication.class, args);
    }
}
