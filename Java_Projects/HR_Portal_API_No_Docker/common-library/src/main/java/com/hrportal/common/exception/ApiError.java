package com.hrportal.common.exception;

import java.time.Instant;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonInclude;

/** Standard error body returned by every service and by the gateway. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiError(Instant timestamp, int status, String error, String code, String message, String path,
                       String correlationId, Map<String, String> fieldErrors) {
}
