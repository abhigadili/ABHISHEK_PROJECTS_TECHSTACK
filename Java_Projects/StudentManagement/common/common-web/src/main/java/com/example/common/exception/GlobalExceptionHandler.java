package com.example.common.exception;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ResourceNotFoundException.class)
    ResponseEntity<ApiError> notFound(ResourceNotFoundException e, HttpServletRequest r) { return build(HttpStatus.NOT_FOUND, e.getMessage(), r, null); }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<ApiError> noResource(NoResourceFoundException e, HttpServletRequest r) { return build(HttpStatus.NOT_FOUND, "Resource not found", r, null); }

    @ExceptionHandler({ConflictException.class, OptimisticLockingFailureException.class})
    ResponseEntity<ApiError> conflict(Exception e, HttpServletRequest r) { return build(HttpStatus.CONFLICT, e.getMessage(), r, null); }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiError> integrity(DataIntegrityViolationException e, HttpServletRequest r) {
        log.warn("Data integrity violation: {}", e.getMostSpecificCause().getMessage());
        return build(HttpStatus.CONFLICT, "Operation violates a uniqueness or integrity constraint", r, null);
    }

    @ExceptionHandler(BusinessRuleException.class)
    ResponseEntity<ApiError> rule(BusinessRuleException e, HttpServletRequest r) { return build(HttpStatus.UNPROCESSABLE_ENTITY, e.getMessage(), r, null); }

    @ExceptionHandler(ServiceUnavailableException.class)
    ResponseEntity<ApiError> unavailable(ServiceUnavailableException e, HttpServletRequest r) {
        log.warn("Downstream unavailable: {}", e.getMessage());
        return build(HttpStatus.SERVICE_UNAVAILABLE, e.getMessage(), r, null);
    }

    @ExceptionHandler(UnauthorizedException.class)
    ResponseEntity<ApiError> unauthorized(UnauthorizedException e, HttpServletRequest r) { return build(HttpStatus.UNAUTHORIZED, e.getMessage(), r, null); }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ApiError> denied(AccessDeniedException e, HttpServletRequest r) { return build(HttpStatus.FORBIDDEN, "You do not have permission to perform this action", r, null); }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> invalid(MethodArgumentNotValidException e, HttpServletRequest r) {
        Map<String, String> fields = new LinkedHashMap<>();
        e.getBindingResult().getFieldErrors().forEach(f -> fields.putIfAbsent(f.getField(), f.getDefaultMessage()));
        return build(HttpStatus.BAD_REQUEST, "Validation failed", r, fields);
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
            MissingRequestHeaderException.class, IllegalArgumentException.class})
    ResponseEntity<ApiError> badRequest(Exception e, HttpServletRequest r) { return build(HttpStatus.BAD_REQUEST, "Malformed request: " + e.getMessage(), r, null); }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> other(Exception e, HttpServletRequest r) {
        log.error("Unhandled exception on {} {}", r.getMethod(), r.getRequestURI(), e);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "Unexpected server error", r, null);
    }

    private ResponseEntity<ApiError> build(HttpStatus s, String msg, HttpServletRequest r, Map<String, String> fields) {
        return ResponseEntity.status(s).body(new ApiError(Instant.now(), s.value(), s.getReasonPhrase(), msg, r.getRequestURI(), fields));
    }
}
