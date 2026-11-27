package com.hrportal.common.web;

import java.time.Instant;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Liveness probe for scripts (not a monitoring component). */
@RestController
public class PingController {
    private final String service;

    public PingController(@Value("${spring.application.name}") String service) {
        this.service = service;
    }

    @GetMapping("/ping")
    public Map<String, Object> ping() {
        return Map.of("service", service, "status", "UP", "time", Instant.now().toString());
    }
}
