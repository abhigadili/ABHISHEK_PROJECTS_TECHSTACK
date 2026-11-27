package com.studentmgmt.notification.service;

import com.studentmgmt.notification.event.EnrollmentOutcomeEvent;

public interface EnrollmentOutcomeService {

    /** Called by the Kafka listeners for `enrollment.confirmed` / `enrollment.rejected`. */
    void handle(EnrollmentOutcomeEvent event);
}
