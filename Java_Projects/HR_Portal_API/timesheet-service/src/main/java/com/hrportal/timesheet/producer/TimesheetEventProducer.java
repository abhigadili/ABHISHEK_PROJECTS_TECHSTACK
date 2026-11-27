package com.hrportal.timesheet.producer;

import java.util.Map;

import org.springframework.stereotype.Component;

import com.hrportal.common.events.EventMetadata;
import com.hrportal.common.events.HrEvents.NotificationRequested;
import com.hrportal.common.events.HrEvents.TimesheetApproved;
import com.hrportal.common.events.HrEvents.TimesheetSubmitted;
import com.hrportal.common.events.Topics;
import com.hrportal.common.kafka.EventPublisher;
import com.hrportal.timesheet.entity.Timesheet;

@Component
public class TimesheetEventProducer {
    private final EventPublisher publisher;

    public TimesheetEventProducer(EventPublisher publisher) {
        this.publisher = publisher;
    }

    public void submitted(Timesheet t) {
        publisher.publish(Topics.TIMESHEET_SUBMITTED, t.getEmployeeId(), new TimesheetSubmitted(EventMetadata.of(Topics.TIMESHEET_SUBMITTED), t.getEmployeeId(),
                t.getId(), t.getWeekStart(), t.getTotalHours(), t.getBillableHours(), t.getApproverId()));
    }

    public void approved(Timesheet t) {
        publisher.publish(Topics.TIMESHEET_APPROVED, t.getEmployeeId(), new TimesheetApproved(EventMetadata.of(Topics.TIMESHEET_APPROVED), t.getEmployeeId(),
                t.getId(), t.getWeekStart(), t.getTotalHours(), t.getBillableHours(), t.getApproverId()));
    }

    public void notify(String recipientEmployeeId, String template, Timesheet t, String comment) {
        publisher.publish(Topics.NOTIFICATION_REQUESTED, recipientEmployeeId, NotificationRequested.of(recipientEmployeeId, null, template, template,
                Map.of("employeeName", String.valueOf(t.getEmployeeName()), "weekStart", t.getWeekStart().toString(), "hours", t.getTotalHours().toPlainString(),
                        "comment", comment == null ? "" : comment), "TIMESHEET", t.getId(), template + ":" + t.getId() + ":" + t.getResubmissionCount() + ":" + recipientEmployeeId));
    }
}
