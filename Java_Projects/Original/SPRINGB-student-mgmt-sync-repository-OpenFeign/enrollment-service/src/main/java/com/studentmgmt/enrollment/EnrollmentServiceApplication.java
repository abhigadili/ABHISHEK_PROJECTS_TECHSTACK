package com.studentmgmt.enrollment;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;

/**
 * Owns EnrollmentDB exclusively. This is the one service in the system that
 * talks to its peers over the network: before creating an Enrollment it
 * synchronously calls student-service and course-service to confirm the
 * referenced ids exist, and after a successful Payment it synchronously
 * calls notification-service to trigger a confirmation notification.
 *
 * This variant reaches its peers with declarative Spring Cloud OpenFeign
 * clients (see client/*FeignClient.java) instead of RestTemplate. Feign
 * calls are still fully synchronous/blocking under the hood — only the
 * calling code changes, not the communication style.
 *
 * @EnableFeignClients triggers component scanning for @FeignClient
 * interfaces and registers a dynamic proxy bean for each one at startup.
 */
@SpringBootApplication
@EnableFeignClients
public class EnrollmentServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(EnrollmentServiceApplication.class, args);
    }
}
