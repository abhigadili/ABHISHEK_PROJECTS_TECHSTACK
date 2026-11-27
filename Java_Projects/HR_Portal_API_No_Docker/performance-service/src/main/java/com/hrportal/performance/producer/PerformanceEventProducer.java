package com.hrportal.performance.producer;

import java.math.BigDecimal;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.hrportal.common.events.EventMetadata;
import com.hrportal.common.events.HrEvents.NotificationRequested;
import com.hrportal.common.events.HrEvents.PerformanceReviewApproved;
import com.hrportal.common.events.HrEvents.PerformanceReviewSubmitted;
import com.hrportal.common.events.Topics;
import com.hrportal.common.kafka.EventPublisher;
import com.hrportal.performance.entity.PerformanceReview;

@Component
public class PerformanceEventProducer {
    private final EventPublisher publisher;

    public PerformanceEventProducer(EventPublisher publisher) {
        this.publisher = publisher;
    }

    public void submitted(PerformanceReview r, String stage, BigDecimal rating) {
        publisher.publish(Topics.PERFORMANCE_REVIEW_SUBMITTED, r.getEmployeeId(), new PerformanceReviewSubmitted(EventMetadata.of(Topics.PERFORMANCE_REVIEW_SUBMITTED), r.getEmployeeId(),
                r.getId(), r.getCycleId(), stage, r.getManagerId(), rating));
    }

    public void approved(PerformanceReview r) {
        publisher.publish(Topics.PERFORMANCE_REVIEW_APPROVED, r.getEmployeeId(), new PerformanceReviewApproved(EventMetadata.of(Topics.PERFORMANCE_REVIEW_APPROVED), r.getEmployeeId(),
                r.getId(), r.getCycleId(), r.getFinalRating()));
    }

    public void notify(String employeeId, String template, PerformanceReview r, String comment, String dedup) {
        publisher.publish(Topics.NOTIFICATION_REQUESTED, employeeId, NotificationRequested.of(employeeId, null, template, template,
                Map.of("employeeName", String.valueOf(r.getEmployeeName()), "comment", comment == null ? "" : comment), "REVIEW", r.getId(), dedup));
    }
}
