package com.hospital.common.kafka;

import java.time.Instant;
import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OutboxEventRepository extends JpaRepository<OutboxEvent, Long> {
    List<OutboxEvent> findBySentAtIsNullAndCreatedAtBeforeOrderByIdAsc(Instant before, Pageable pageable);
}
