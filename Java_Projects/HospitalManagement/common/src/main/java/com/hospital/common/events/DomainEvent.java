package com.hospital.common.events;

import java.time.Instant;

/** Every event carries a unique id (used for consumer idempotency) and its occurrence time. */
public interface DomainEvent {
    String eventId();

    Instant occurredAt();
}
