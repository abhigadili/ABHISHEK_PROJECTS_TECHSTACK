package com.studentmgmt.notification;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Owns NotificationDB exclusively. enrollment-service calls this service
 * synchronously (RestTemplate) after a successful payment to record and
 * "send" a confirmation notification.
 */
@SpringBootApplication
public class NotificationServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(NotificationServiceApplication.class, args);
    }
}
