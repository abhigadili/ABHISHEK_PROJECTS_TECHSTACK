package com.fooddelivery.common.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fooddelivery.common.exception.BusinessException;
import com.fooddelivery.common.exception.RemoteServiceException;
import io.github.resilience4j.bulkhead.BulkheadFullException;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/** One place that turns every failure into the standard {@link ApiError} body. */
@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private ResponseEntity<ApiError> build(HttpStatus status, String code, String msg, HttpServletRequest req,
                                           Map<String, String> details) {
        return ResponseEntity.status(status).body(new ApiError(Instant.now(), status.value(), status.getReasonPhrase(),
                code, msg, req.getRequestURI(), Correlation.current(), details));
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiError> business(BusinessException e, HttpServletRequest r) {
        log.warn("Business rule violation [{}]: {}", e.getCode(), e.getMessage());
        return build(e.getStatus(), e.getCode(), e.getMessage(), r, null);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> invalid(MethodArgumentNotValidException e, HttpServletRequest r) {
        Map<String, String> d = new LinkedHashMap<>();
        e.getBindingResult().getFieldErrors().forEach(f -> d.putIfAbsent(f.getField(), f.getDefaultMessage()));
        e.getBindingResult().getGlobalErrors().forEach(g -> d.putIfAbsent(g.getObjectName(), g.getDefaultMessage()));
        return build(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Request validation failed", r, d);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiError> constraint(ConstraintViolationException e, HttpServletRequest r) {
        Map<String, String> d = new LinkedHashMap<>();
        e.getConstraintViolations().forEach(v -> d.putIfAbsent(v.getPropertyPath().toString(), v.getMessage()));
        return build(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Request validation failed", r, d);
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class, IllegalArgumentException.class})
    public ResponseEntity<ApiError> badRequest(Exception e, HttpServletRequest r) {
        return build(HttpStatus.BAD_REQUEST, "BAD_REQUEST", e.getMessage(), r, null);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> denied(AccessDeniedException e, HttpServletRequest r) {
        return build(HttpStatus.FORBIDDEN, "FORBIDDEN", "You do not have permission for this operation", r, null);
    }

    @ExceptionHandler({OptimisticLockingFailureException.class, DataIntegrityViolationException.class})
    public ResponseEntity<ApiError> conflict(Exception e, HttpServletRequest r) {
        log.warn("Data conflict: {}", e.getMessage());
        return build(HttpStatus.CONFLICT, "CONFLICT", "The resource was modified concurrently or violates a constraint", r, null);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> tooLarge(MaxUploadSizeExceededException e, HttpServletRequest r) {
        return build(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "Uploaded file is too large", r, null);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiError> method(HttpRequestMethodNotSupportedException e, HttpServletRequest r) {
        return build(HttpStatus.METHOD_NOT_ALLOWED, "METHOD_NOT_ALLOWED", e.getMessage(), r, null);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiError> noResource(NoResourceFoundException e, HttpServletRequest r) {
        return build(HttpStatus.NOT_FOUND, "NOT_FOUND", "No such resource", r, null);
    }

    @ExceptionHandler(RemoteServiceException.class)
    public ResponseEntity<ApiError> remote(RemoteServiceException e, HttpServletRequest r) {
        log.warn("Remote call to {} failed with {}: {}", e.getService(), e.getStatus(), e.getMessage());
        HttpStatus s = e.isClientError() ? HttpStatus.valueOf(e.getStatus()) : HttpStatus.BAD_GATEWAY;
        return build(s, "UPSTREAM_" + (e.isClientError() ? "REJECTED" : "FAILURE"), e.getMessage(), r, null);
    }

    @ExceptionHandler({CallNotPermittedException.class, BulkheadFullException.class})
    public ResponseEntity<ApiError> unavailable(Exception e, HttpServletRequest r) {
        log.warn("Resilience guard rejected call: {}", e.getMessage());
        return build(HttpStatus.SERVICE_UNAVAILABLE, "DEPENDENCY_UNAVAILABLE",
                "A dependent service is temporarily unavailable; please retry shortly", r, null);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> unexpected(Exception e, HttpServletRequest r) {
        log.error("Unhandled exception on {} {}", r.getMethod(), r.getRequestURI(), e);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Unexpected server error", r, null);
    }
}
