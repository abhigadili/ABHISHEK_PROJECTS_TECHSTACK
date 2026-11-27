package com.hospital.common.web;

import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Minimal liveness probe, reachable on the service port only (the gateway does not route /ping). */
@RestController
public class PingController {
    @Value("${spring.application.name}")
    private String name;

    @GetMapping("/ping")
    public Map<String, String> ping() {
        return Map.of("service", name, "status", "UP");
    }
}
