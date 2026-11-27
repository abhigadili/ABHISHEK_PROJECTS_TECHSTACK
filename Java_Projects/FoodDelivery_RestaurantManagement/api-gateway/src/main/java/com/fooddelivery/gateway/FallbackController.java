package com.fooddelivery.gateway;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.Map;

/** Graceful degradation: what the client sees when a downstream service is down or its circuit is open. */
@RestController
public class FallbackController {
    @RequestMapping("/fallback/{service}")
    public Mono<ResponseEntity<Map<String, Object>>> fallback(@PathVariable String service) {
        return Mono.just(ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                "timestamp", Instant.now().toString(), "status", 503, "error", "Service Unavailable",
                "code", "SERVICE_UNAVAILABLE", "message", "The " + service + " service is temporarily unavailable. Please try again shortly.")));
    }
}
