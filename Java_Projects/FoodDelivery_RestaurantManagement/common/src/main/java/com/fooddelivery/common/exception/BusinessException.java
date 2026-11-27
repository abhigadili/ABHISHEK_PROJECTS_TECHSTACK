package com.fooddelivery.common.exception;

import org.springframework.http.HttpStatus;

/** Base class for expected business failures; carries the HTTP status and a stable machine-readable code. */
public class BusinessException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    public BusinessException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus getStatus() { return status; }
    public String getCode() { return code; }
}
