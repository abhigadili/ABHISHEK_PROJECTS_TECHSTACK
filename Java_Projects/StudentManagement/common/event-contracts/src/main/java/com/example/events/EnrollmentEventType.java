package com.example.events;

public enum EnrollmentEventType {
    EnrollmentRequested(Topics.ENROLLMENT_REQUESTED),
    EnrollmentConfirmed(Topics.ENROLLMENT_CONFIRMED),
    EnrollmentRejected(Topics.ENROLLMENT_REJECTED),
    EnrollmentCancelled(Topics.ENROLLMENT_CANCELLED);

    private final String topic;

    EnrollmentEventType(String topic) { this.topic = topic; }

    public String topic() { return topic; }
}
