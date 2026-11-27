package com.example.events;

/** Kafka topic names shared by producers and consumers. */
public final class Topics {
    private Topics() {}

    public static final String ENROLLMENT_REQUESTED = "enrollment.requested";
    public static final String ENROLLMENT_CONFIRMED = "enrollment.confirmed";
    public static final String ENROLLMENT_REJECTED = "enrollment.rejected";
    public static final String ENROLLMENT_CANCELLED = "enrollment.cancelled";
    public static final String COURSE_LOW_AVAILABILITY = "course.low-availability";
    public static final String DLT_SUFFIX = ".DLT";

    public static final String[] ENROLLMENT_TOPICS = {
            ENROLLMENT_REQUESTED, ENROLLMENT_CONFIRMED, ENROLLMENT_REJECTED, ENROLLMENT_CANCELLED
    };
}
