package com.hrportal.attendance.producer;

import java.util.Map;

import org.springframework.stereotype.Component;

import com.hrportal.attendance.entity.AttendanceRecord;
import com.hrportal.common.events.EventMetadata;
import com.hrportal.common.events.HrEvents.AttendanceCheckedIn;
import com.hrportal.common.events.HrEvents.AttendanceCheckedOut;
import com.hrportal.common.events.HrEvents.AttendanceCorrected;
import com.hrportal.common.events.HrEvents.NotificationRequested;
import com.hrportal.common.events.Topics;
import com.hrportal.common.kafka.EventPublisher;

@Component
public class AttendanceEventProducer {
    private final EventPublisher publisher;

    public AttendanceEventProducer(EventPublisher publisher) {
        this.publisher = publisher;
    }

    public void checkedIn(AttendanceRecord r) {
        publisher.publish(Topics.ATTENDANCE_CHECKED_IN, r.getEmployeeId(), new AttendanceCheckedIn(EventMetadata.of(Topics.ATTENDANCE_CHECKED_IN),
                r.getEmployeeId(), r.getId(), r.getWorkDate(), r.getCheckIn(), r.getWorkMode().name(), r.getLateMinutes()));
    }

    public void checkedOut(AttendanceRecord r) {
        publisher.publish(Topics.ATTENDANCE_CHECKED_OUT, r.getEmployeeId(), new AttendanceCheckedOut(EventMetadata.of(Topics.ATTENDANCE_CHECKED_OUT),
                r.getEmployeeId(), r.getId(), r.getWorkDate(), r.getCheckOut(), r.getWorkedMinutes(), r.getOvertimeMinutes(), r.getEarlyDepartureMinutes()));
    }

    public void corrected(AttendanceRecord r, String correctedBy, String reason) {
        publisher.publish(Topics.ATTENDANCE_CORRECTED, r.getEmployeeId(), new AttendanceCorrected(EventMetadata.of(Topics.ATTENDANCE_CORRECTED),
                r.getEmployeeId(), r.getId(), r.getWorkDate(), correctedBy, reason));
    }

    public void notify(String employeeId, String template, String refId, Map<String, String> params, String dedup) {
        publisher.publish(Topics.NOTIFICATION_REQUESTED, employeeId, NotificationRequested.of(employeeId, null, template, template, params, "ATTENDANCE", refId, dedup));
    }
}
