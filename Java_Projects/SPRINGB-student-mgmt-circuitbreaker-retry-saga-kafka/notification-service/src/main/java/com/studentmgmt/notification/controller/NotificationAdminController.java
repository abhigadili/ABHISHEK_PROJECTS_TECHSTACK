package com.studentmgmt.notification.controller;

import com.studentmgmt.notification.service.SimulatedExternalGateway;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * ADMIN-only (enforced by api-gateway's AuthorizationPolicy on the
 * "/api/notifications/admin" path prefix) lever for demonstrating Retry +
 * Circuit Breaker on demand: flip the simulated gateway to failing, create
 * a couple of enrollments so notification-service tries to dispatch, watch
 * the logs and GET /actuator/health show the circuit breaker trip, then
 * flip it back and watch it recover after `wait-duration-in-open-state`.
 */
@RestController
@RequestMapping("/api/notifications/admin")
public class NotificationAdminController {

    private final SimulatedExternalGateway simulatedExternalGateway;

    public NotificationAdminController(SimulatedExternalGateway simulatedExternalGateway) {
        this.simulatedExternalGateway = simulatedExternalGateway;
    }

    @PostMapping("/toggle-failure")
    public Map<String, Object> toggleFailure(@RequestParam(required = false) Boolean failing) {
        boolean newValue = failing != null ? failing : !simulatedExternalGateway.isForcedFailure();
        simulatedExternalGateway.setForcedFailure(newValue);
        return Map.of("simulatedGatewayFailing", newValue);
    }
}
