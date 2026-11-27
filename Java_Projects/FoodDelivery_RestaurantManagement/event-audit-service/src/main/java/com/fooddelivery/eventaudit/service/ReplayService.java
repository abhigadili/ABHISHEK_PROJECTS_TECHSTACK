package com.fooddelivery.eventaudit.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fooddelivery.common.aop.Audited;
import com.fooddelivery.common.exception.BadRequestException;
import com.fooddelivery.common.exception.BusinessException;
import com.fooddelivery.common.exception.NotFoundException;
import com.fooddelivery.common.kafka.EventPublisher;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.kafka.Topics;
import com.fooddelivery.eventaudit.domain.EventAudit;
import com.fooddelivery.eventaudit.monitor.KafkaMonitorService;
import com.fooddelivery.eventaudit.repository.EventAuditRepository;
import com.fooddelivery.eventaudit.web.Dtos;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Controlled administrative actions on Kafka. Deliberately NOT offered: deleting messages/topics or moving consumer offsets.
 * <ul>
 *   <li><b>Test publish</b>: only to topics in {@code food.audit.publishable-topics}; goes through the outbox like any business event.</li>
 *   <li><b>Replay</b>: re-publishes the ORIGINAL record (read back from Kafka) of a failed consumption with header {@code x-replay}.
 *       Safe by design: groups that already processed the eventId skip it (idempotency ledger); a record can be replayed at most
 *       {@code max-replays} times, never twice within 30 s, and only while its status is FAILED / DEAD_LETTERED.</li>
 * </ul>
 */
@Service
public class ReplayService {
    private static final Logger log = LoggerFactory.getLogger(ReplayService.class);
    private final EventAuditRepository audits;
    private final KafkaMonitorService kafka;
    private final KafkaTemplate<String, String> template;
    private final EventPublisher publisher;
    private final List<String> publishable;
    private final int maxReplays;

    public ReplayService(EventAuditRepository audits, KafkaMonitorService kafka, KafkaTemplate<String, String> template, EventPublisher publisher,
                         @Value("${food.audit.publishable-topics}") List<String> publishable, @Value("${food.audit.max-replays:3}") int maxReplays) {
        this.audits = audits;
        this.kafka = kafka;
        this.template = template;
        this.publisher = publisher;
        this.publishable = publishable;
        this.maxReplays = maxReplays;
    }

    @Audited("KAFKA_TEST_PUBLISH")
    @Transactional
    public String publishTest(String topic, Dtos.PublishTestRequest r) {
        if (!publishable.contains(topic)) throw new BadRequestException("TOPIC_NOT_ALLOWED", "Test events may only be published to: " + publishable);
        var env = publisher.publish(topic, "TestNotification", String.valueOf(r.userId()), String.valueOf(r.userId()),
                new Events.NotificationRequested(r.userId(), r.title(), r.message(), "ADMIN_TEST", "IN_APP"));
        log.info("Admin test event queued eventId={} topic={}", env.eventId(), topic);
        return env.eventId();
    }

    @Audited("KAFKA_REPLAY")
    @Transactional
    public Dtos.ReplayResult replay(Long auditId) {
        EventAudit a = audits.findById(auditId).orElseThrow(() -> new NotFoundException("Audit record", auditId));
        if (!"CONSUMED".equals(a.getRole()) || !(a.getStatus().equals("FAILED") || a.getStatus().equals("DEAD_LETTERED"))) {
            throw new BusinessException(HttpStatus.CONFLICT, "NOT_REPLAYABLE", "Only failed consumptions (FAILED / DEAD_LETTERED) can be replayed; this one is " + a.getStatus());
        }
        if (a.getReplayCount() >= maxReplays) throw new BusinessException(HttpStatus.CONFLICT, "REPLAY_LIMIT", "Replay limit (" + maxReplays + ") reached for this record");
        if (a.getLastReplayAt() != null && a.getLastReplayAt().isAfter(Instant.now().minus(Duration.ofSeconds(30)))) {
            throw new BusinessException(HttpStatus.CONFLICT, "REPLAY_TOO_SOON", "This record was replayed less than 30 seconds ago; wait for the result");
        }
        if (a.getPartitionNo() == null || a.getOffsetNo() == null) throw new BadRequestException("The record has no Kafka position to read back");
        ConsumerRecord<String, String> original = kafka.readExact(a.getTopic(), a.getPartitionNo(), a.getOffsetNo());
        if (original == null) throw new BusinessException(HttpStatus.GONE, "MESSAGE_EXPIRED", "The original message is no longer retained in Kafka");
        ProducerRecord<String, String> rec = new ProducerRecord<>(a.getTopic(), original.key(), original.value());
        original.headers().forEach(h -> { if (!h.key().startsWith("kafka_") && !h.key().startsWith("x-replay")) rec.headers().add(h); });
        rec.headers().add("x-replay", "true".getBytes(StandardCharsets.UTF_8));
        rec.headers().add("x-replay-of-audit", String.valueOf(auditId).getBytes(StandardCharsets.UTF_8));
        try { template.send(rec).get(5, java.util.concurrent.TimeUnit.SECONDS); }
        catch (Exception e) { throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "KAFKA_UNAVAILABLE", "Could not publish the replay: " + e.getMessage()); }
        a.setReplayCount(a.getReplayCount() + 1);
        a.setLastReplayAt(Instant.now());
        log.warn("Replayed {} {}-{}@{} (replay #{})", a.getEventId(), a.getTopic(), a.getPartitionNo(), a.getOffsetNo(), a.getReplayCount());
        return new Dtos.ReplayResult(true, "Original message re-published; the failing consumer group will retry it, other groups skip it as a duplicate", a.getReplayCount());
    }
}
