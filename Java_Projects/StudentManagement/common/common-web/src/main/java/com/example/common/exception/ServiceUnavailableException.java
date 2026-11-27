package com.example.common.exception;

/** HTTP 503: a downstream dependency is unavailable (circuit open, timeout, ...). */
public class ServiceUnavailableException extends RuntimeException {
    public ServiceUnavailableException(String message, Throwable cause) { super(message, cause); }
    public ServiceUnavailableException(String message) { super(message); }
}
