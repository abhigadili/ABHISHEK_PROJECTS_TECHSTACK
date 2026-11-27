package com.example.gateway.controller;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PathVariable;

/** Target of the circuit-breaker fallbackUri: a clean 503 instead of a gateway timeout/stack trace when a downstream service is down. */
@RestController
public class FallbackController {
    private static final Logger log = LoggerFactory.getLogger(FallbackController.class);

    @RequestMapping("/fallback/{service}")
    public ResponseEntity<Map<String, Object>> fallback(@PathVariable String service) {
        log.warn("Fallback served for {}", service);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("status", 503);
        body.put("error", "Service Unavailable");
        body.put("message", service + " is currently unavailable. Please retry shortly.");
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(body);
    }
}
