package com.example.enrollment.entity;

public enum SagaState {
    STARTED, STUDENT_VALIDATED, COURSE_VALIDATED, PENDING_CREATED, SEAT_RESERVED, COMPLETED, COMPENSATING, REJECTED;

    public boolean isTerminal() { return this == COMPLETED || this == REJECTED; }
}
