package com.fooddelivery.common.exception;

/** A Kafka message failed structural/business validation. Never retried: goes straight to the dead-letter topic. */
public class InvalidEventException extends RuntimeException {
    public InvalidEventException(String message) { super(message); }
    public InvalidEventException(String message, Throwable cause) { super(message, cause); }
}
