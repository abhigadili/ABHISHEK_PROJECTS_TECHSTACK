package com.fooddelivery.common.web;

import java.time.Instant;
import java.util.Map;

/** Standard error body returned by every service. */
public record ApiError(Instant timestamp, int status, String error, String code, String message,
                       String path, String correlationId, Map<String, String> details) {}
