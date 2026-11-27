package com.fooddelivery.eventaudit.repository;

import com.fooddelivery.eventaudit.domain.EventAudit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface EventAuditRepository extends JpaRepository<EventAudit, Long>, JpaSpecificationExecutor<EventAudit> {
    Optional<EventAudit> findByDedupeKey(String dedupeKey);
    List<EventAudit> findByCorrelationIdOrderByEventTimestampAscIdAsc(String correlationId);
    List<EventAudit> findByEventIdOrderByIdAsc(String eventId);

    @Query("select a.status, count(a) from EventAudit a where a.role = :role group by a.status")
    List<Object[]> countByStatus(String role);

    @Query("select a.topic, count(a) from EventAudit a where a.role = 'PUBLISHED' group by a.topic")
    List<Object[]> publishedPerTopic();

    @Query("select a.topic, a.status, count(a) from EventAudit a where a.role = 'CONSUMED' group by a.topic, a.status")
    List<Object[]> consumedPerTopicStatus();

    @Modifying
    @Query("delete from EventAudit a where a.recordedAt < :cutoff")
    int deleteOlderThan(Instant cutoff);
}
