package com.studentmgmt.notification.service;

import org.springframework.stereotype.Component;

/**
 * Stands in for a real third-party email/SMS provider (SendGrid, Twilio,
 * ...) so this project can demonstrate Retry + Circuit Breaker WITHOUT
 * actually sending email or SMS or requiring any external account/API key.
 * `forcedFailure` is flipped by NotificationAdminController's
 * POST /api/notifications/admin/toggle-failure (ADMIN only) — flip it on,
 * then create a few enrollments, and watch NotificationDispatchService's
 * Retry attempts and eventual Circuit Breaker trip in the logs and in
 * GET /actuator/health.
 */
@Component
public class SimulatedExternalGateway {

    private volatile boolean forcedFailure = false;

    public void setForcedFailure(boolean forcedFailure) {
        this.forcedFailure = forcedFailure;
    }

    public boolean isForcedFailure() {
        return forcedFailure;
    }

    public void send(String channel, String message) {
        if (forcedFailure) {
            throw new IllegalStateException("Simulated external " + channel + " gateway outage");
        }
        // "Success" — in a real integration this is where the HTTP call to
        // the actual email/SMS provider would go.
    }
}
