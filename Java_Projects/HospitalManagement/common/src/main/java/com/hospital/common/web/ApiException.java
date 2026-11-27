package com.hospital.common.web;

import org.springframework.http.HttpStatus;

/** Base class for every business error that must be mapped to an HTTP status. */
public class ApiException extends RuntimeException {
    private final HttpStatus status;

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
