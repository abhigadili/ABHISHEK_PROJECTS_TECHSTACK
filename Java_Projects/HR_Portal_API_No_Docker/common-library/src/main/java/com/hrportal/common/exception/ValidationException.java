package com.hrportal.common.exception;

import java.util.Map;

import org.springframework.http.HttpStatus;

/** Business-rule validation failure with per-field messages (400). */
public class ValidationException extends ApiException {
    private final transient Map<String, String> fieldErrors;

    public ValidationException(String message, Map<String, String> fieldErrors) {
        super(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", message);
        this.fieldErrors = fieldErrors == null ? Map.of() : Map.copyOf(fieldErrors);
    }

    public ValidationException(String field, String message) {
        this(message, Map.of(field, message));
    }

    public Map<String, String> getFieldErrors() {
        return fieldErrors;
    }
}
