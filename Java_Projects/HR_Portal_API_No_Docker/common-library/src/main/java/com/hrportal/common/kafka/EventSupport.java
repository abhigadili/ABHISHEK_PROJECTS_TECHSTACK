package com.hrportal.common.kafka;

import java.util.Optional;

/** Tiny helper used by producers so event keys are never null. */
public final class EventSupport {
    private EventSupport() {
    }

    public static String key(String employeeId, String fallback) {
        return Optional.ofNullable(employeeId).orElse(fallback);
    }
}
