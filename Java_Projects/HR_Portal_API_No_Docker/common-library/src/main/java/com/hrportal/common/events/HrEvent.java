package com.hrportal.common.events;

/** Contract of every event DTO published on Kafka. */
public interface HrEvent {
    EventMetadata metadata();

    /** The employee the event is about (null for run-level events such as a payroll run). */
    String employeeId();

    default String eventId() {
        return metadata().eventId();
    }
}
