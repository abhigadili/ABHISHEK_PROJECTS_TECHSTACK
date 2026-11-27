package com.fooddelivery.common.kafka.outbox;

import jakarta.persistence.LockModeType;
import jakarta.persistence.QueryHint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.QueryHints;

import java.util.List;

public interface OutboxRepository extends JpaRepository<OutboxEvent, String> {
    /** Pessimistic lock with SKIP LOCKED (-2): several instances of a service can relay without double-sending. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "-2"))
    List<OutboxEvent> findTop50ByStatusOrderByCreatedAtAsc(OutboxEvent.Status status);

    long countByStatus(OutboxEvent.Status status);
}
