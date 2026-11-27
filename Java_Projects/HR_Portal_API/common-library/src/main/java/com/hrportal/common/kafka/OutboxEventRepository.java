package com.hrportal.common.kafka;

import java.time.Instant;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OutboxEventRepository extends JpaRepository<OutboxEvent, Long> {
    List<OutboxEvent> findBySentAtIsNullAndCreatedAtBeforeOrderByIdAsc(Instant before, Pageable pageable);

    Page<OutboxEvent> findByTopicContaining(String topic, Pageable pageable);
}
