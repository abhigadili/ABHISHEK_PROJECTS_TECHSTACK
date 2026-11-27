package com.studentmgmt.course;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Owns CourseDB exclusively. enrollment-service reaches this data only
 * through this service's REST API (synchronous RestTemplate calls).
 */
@SpringBootApplication
public class CourseServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(CourseServiceApplication.class, args);
    }
}
