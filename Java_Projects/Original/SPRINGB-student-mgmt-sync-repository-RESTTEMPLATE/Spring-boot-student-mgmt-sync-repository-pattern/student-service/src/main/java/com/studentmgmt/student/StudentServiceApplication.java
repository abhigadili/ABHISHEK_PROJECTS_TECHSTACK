package com.studentmgmt.student;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Owns StudentDB exclusively. No other microservice in this system is allowed
 * to connect to StudentDB directly — enrollment-service reaches this data
 * only through this service's REST API (synchronous RestTemplate calls).
 */
@SpringBootApplication
public class StudentServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(StudentServiceApplication.class, args);
    }
}
