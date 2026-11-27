package com.fooddelivery.eventaudit.service;

import com.fooddelivery.common.exception.NotFoundException;
import com.fooddelivery.eventaudit.domain.EventAudit;
import com.fooddelivery.eventaudit.repository.EventAuditRepository;
import com.fooddelivery.eventaudit.web.Dtos;
import jakarta.persistence.criteria.Predicate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Service
public class AuditQueryService {
    private static final Logger log = LoggerFactory.getLogger(AuditQueryService.class);
    private static final List<String> FAILED = List.of("FAILED", "DEAD_LETTERED", "REJECTED_INVALID");
    private final EventAuditRepository repo;
    private final long retentionDays;

    public AuditQueryService(EventAuditRepository repo, @Value("${food.audit.retention-days:14}") long retentionDays) {
        this.repo = repo;
        this.retentionDays = retentionDays;
    }

    @Transactional(readOnly = true)
    public Page<Dtos.AuditDto> search(String role, String topic, String eventType, String status, String service, String q, Instant from, Instant to, boolean failedOnly, int page, int size) {
        Specification<EventAudit> spec = (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (notBlank(role)) p.add(cb.equal(root.get("role"), role));
            if (notBlank(topic)) p.add(cb.equal(root.get("topic"), topic));
            if (notBlank(eventType)) p.add(cb.equal(root.get("eventType"), eventType));
            if (notBlank(status)) p.add(cb.equal(root.get("status"), status));
            if (failedOnly) p.add(root.get("status").in(FAILED));
            if (notBlank(service)) p.add(cb.or(cb.equal(root.get("producerService"), service), cb.equal(root.get("consumerService"), service)));
            if (from != null) p.add(cb.greaterThanOrEqualTo(root.get("eventTimestamp"), from));
            if (to != null) p.add(cb.lessThan(root.get("eventTimestamp"), to));
            if (notBlank(q)) {
                String like = "%" + q.trim().toLowerCase() + "%";
                p.add(cb.or(cb.like(cb.lower(root.get("eventId")), like), cb.like(cb.lower(root.get("msgKey")), like), cb.like(cb.lower(root.get("correlationId")), like),
                        cb.like(cb.lower(root.get("payloadMasked")), like)));
            }
            return cb.and(p.toArray(Predicate[]::new));
        };
        return repo.findAll(spec, PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by(Sort.Direction.DESC, "eventTimestamp").and(Sort.by(Sort.Direction.DESC, "id"))))
                .map(Dtos.AuditDto::from);
    }

    @Transactional(readOnly = true)
    public Dtos.AuditDto get(Long id) { return repo.findById(id).map(Dtos.AuditDto::from).orElseThrow(() -> new NotFoundException("Audit record", id)); }

    /** Request-to-event traceability: everything recorded for one correlation id, oldest first. */
    @Transactional(readOnly = true)
    public List<Dtos.AuditDto> trace(String correlationId) {
        return repo.findByCorrelationIdOrderByEventTimestampAscIdAsc(correlationId).stream().map(Dtos.AuditDto::from).toList();
    }

    @Transactional(readOnly = true)
    public Dtos.AuditStats stats() {
        Map<String, Long> consumed = new LinkedHashMap<>(), published = new LinkedHashMap<>();
        repo.countByStatus("CONSUMED").forEach(r -> consumed.put((String) r[0], (Long) r[1]));
        repo.countByStatus("PUBLISHED").forEach(r -> published.put((String) r[0], (Long) r[1]));
        Map<String, Long> perTopic = new TreeMap<>();
        repo.publishedPerTopic().forEach(r -> perTopic.put((String) r[0], (Long) r[1]));
        return new Dtos.AuditStats(published.values().stream().mapToLong(x -> x).sum(), consumed, perTopic);
    }

    @Scheduled(cron = "${food.audit.purge-cron:0 15 3 * * *}")
    @Transactional
    public void purge() {
        int n = repo.deleteOlderThan(Instant.now().minus(Duration.ofDays(retentionDays)));
        log.info("Audit retention: removed {} records older than {} days", n, retentionDays);
    }

    private static boolean notBlank(String s) { return s != null && !s.isBlank(); }
}
