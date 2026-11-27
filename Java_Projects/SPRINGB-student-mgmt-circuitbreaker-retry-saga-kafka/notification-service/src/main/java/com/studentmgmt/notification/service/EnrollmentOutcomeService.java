package com.studentmgmt.notification.service;

import com.studentmgmt.notification.entity.Notification;
import com.studentmgmt.notification.event.EnrollmentOutcomeEvent;
import org.springframework.stereotype.Service;

/**
 * The Saga's last stop: turns a resolved enrollment outcome into concrete
 * notifications. CONFIRMED gets both an EMAIL and an SMS; REJECTED gets an
 * EMAIL explaining why. Nothing is published from here — this is where the
 * choreography chain that started with EnrollmentService.create() ends.
 */
@Service
public class EnrollmentOutcomeService {

    private final NotificationDispatchService notificationDispatchService;

    public EnrollmentOutcomeService(NotificationDispatchService notificationDispatchService) {
        this.notificationDispatchService = notificationDispatchService;
    }

    public void handle(EnrollmentOutcomeEvent event) {
        if ("CONFIRMED".equals(event.getStatus())) {
            String message = "Your enrollment in course " + event.getCourseId() + " is CONFIRMED.";
            notificationDispatchService.dispatch(event.getEnrollmentId(), event.getStudentId(), Notification.Channel.EMAIL, message);
            notificationDispatchService.dispatch(event.getEnrollmentId(), event.getStudentId(), Notification.Channel.SMS, message);
        } else {
            String message = "Your enrollment in course " + event.getCourseId() + " was REJECTED: " + event.getReason();
            notificationDispatchService.dispatch(event.getEnrollmentId(), event.getStudentId(), Notification.Channel.EMAIL, message);
        }
    }
}
