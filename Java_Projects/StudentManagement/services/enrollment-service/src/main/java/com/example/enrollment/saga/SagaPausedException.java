package com.example.enrollment.saga;

/** Thrown by a saga step when progress must wait (dependency down): the saga stays persisted and the recovery job resumes it. */
class SagaPausedException extends RuntimeException {
    SagaPausedException(String message, Throwable cause) { super(message, cause); }
}
