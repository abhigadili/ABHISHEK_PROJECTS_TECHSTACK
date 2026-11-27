package com.hrportal.leave.producer;

import java.util.Map;

import org.springframework.stereotype.Component;

import com.hrportal.common.events.EventMetadata;
import com.hrportal.common.events.HrEvents.LeaveApplied;
import com.hrportal.common.events.HrEvents.LeaveApproved;
import com.hrportal.common.events.HrEvents.LeaveCancelled;
import com.hrportal.common.events.HrEvents.LeaveRejected;
import com.hrportal.common.events.HrEvents.NotificationRequested;
import com.hrportal.common.events.Topics;
import com.hrportal.common.kafka.EventPublisher;
import com.hrportal.leave.entity.LeaveApplication;

/** Producer for leave.* topics and for the notification commands the leave workflow triggers. */
@Component
public class LeaveEventProducer {
    private final EventPublisher publisher;

    public LeaveEventProducer(EventPublisher publisher) {
        this.publisher = publisher;
    }

    public void applied(LeaveApplication a, String leaveType) {
        publisher.publish(Topics.LEAVE_APPLIED, a.getEmployeeId(), new LeaveApplied(EventMetadata.of(Topics.LEAVE_APPLIED), a.getEmployeeId(),
                a.getId(), leaveType, a.getFromDate(), a.getToDate(), a.getDays(), a.getManagerId(), a.getReason()));
        if (a.getManagerId() != null) {
            notify(a.getManagerId(), "LEAVE_APPLIED", a, leaveType, null, "applied");
        }
    }

    public void approved(LeaveApplication a, String leaveType, String by, String comment) {
        publisher.publish(Topics.LEAVE_APPROVED, a.getEmployeeId(), new LeaveApproved(EventMetadata.of(Topics.LEAVE_APPROVED), a.getEmployeeId(),
                a.getId(), leaveType, a.getFromDate(), a.getToDate(), a.getDays(), by, comment));
        notify(a.getEmployeeId(), "LEAVE_APPROVED", a, leaveType, comment, "approved");
    }

    public void rejected(LeaveApplication a, String leaveType, String by, String comment) {
        publisher.publish(Topics.LEAVE_REJECTED, a.getEmployeeId(), new LeaveRejected(EventMetadata.of(Topics.LEAVE_REJECTED), a.getEmployeeId(),
                a.getId(), leaveType, a.getFromDate(), a.getToDate(), a.getDays(), by, comment));
        notify(a.getEmployeeId(), "LEAVE_REJECTED", a, leaveType, comment, "rejected");
    }

    public void cancelled(LeaveApplication a, String leaveType, String by, String comment) {
        publisher.publish(Topics.LEAVE_CANCELLED, a.getEmployeeId(), new LeaveCancelled(EventMetadata.of(Topics.LEAVE_CANCELLED), a.getEmployeeId(),
                a.getId(), leaveType, a.getFromDate(), a.getToDate(), a.getDays(), by, comment));
        notify(a.getEmployeeId(), "LEAVE_CANCELLED", a, leaveType, comment, "cancelled");
    }

    /** Free-form notification to somebody (manager asked to approve, HR asked for the second approval ...). */
    public void notify(String recipientEmployeeId, String template, LeaveApplication a, String leaveType, String comment, String stateKey) {
        publisher.publish(Topics.NOTIFICATION_REQUESTED, recipientEmployeeId, NotificationRequested.of(recipientEmployeeId, null, template, template,
                Map.of("employeeName", String.valueOf(a.getEmployeeName()), "leaveType", leaveType, "fromDate", a.getFromDate().toString(),
                        "toDate", a.getToDate().toString(), "days", a.getDays().toPlainString(), "comment", comment == null ? "" : comment),
                "LEAVE", a.getId(), template + ":" + a.getId() + ":" + recipientEmployeeId + ":" + stateKey));
    }
}
