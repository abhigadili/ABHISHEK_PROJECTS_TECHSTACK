package com.fooddelivery.eventaudit.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fooddelivery.common.kafka.EventEnvelope;
import com.fooddelivery.common.kafka.ProcessingAudit;
import com.fooddelivery.common.kafka.TopologyEntry;
import com.fooddelivery.eventaudit.domain.EventAudit;
import com.fooddelivery.eventaudit.domain.TopologyEdge;
import com.fooddelivery.eventaudit.repository.EventAuditRepository;
import com.fooddelivery.eventaudit.repository.TopologyEdgeRepository;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.common.header.Header;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/** Writes the persistent event history. Every method is an idempotent upsert keyed by a dedupe key (safe under redelivery). */
@Service
public class AuditIngestService {
    private static final Logger log = LoggerFactory.getLogger(AuditIngestService.class);
    private final EventAuditRepository audits;
    private final TopologyEdgeRepository topology;
    private final PayloadMasker masker;
    private final ObjectMapper mapper;

    public AuditIngestService(EventAuditRepository audits, TopologyEdgeRepository topology, PayloadMasker masker, ObjectMapper mapper) {
        this.audits = audits;
        this.topology = topology;
        this.masker = masker;
        this.mapper = mapper;
    }

    /** A message was observed on a business topic: "published". It says nothing about consumption. */
    @Transactional
    public void recordPublished(ConsumerRecord<String, String> rec) {
        String key = "P:" + rec.topic() + ":" + rec.partition() + ":" + rec.offset();
        if (audits.findByDedupeKey(key).isPresent()) return;
        EventAudit a = new EventAudit();
        a.setDedupeKey(key);
        a.setRole("PUBLISHED");
        a.setTopic(rec.topic());
        a.setPartitionNo(rec.partition());
        a.setOffsetNo(rec.offset());
        a.setMsgKey(rec.key());
        a.setStatus("PUBLISHED");
        a.setEventTimestamp(Instant.ofEpochMilli(rec.timestamp()));
        a.setHeadersJson(headers(rec));
        try {
            EventEnvelope env = mapper.readValue(rec.value(), EventEnvelope.class);
            a.setEventId(env.eventId());
            a.setEventType(env.eventType());
            a.setProducerService(env.producerService());
            a.setCorrelationId(env.correlationId());
            if (env.eventTimestamp() != null) a.setEventTimestamp(env.eventTimestamp());
            a.setPayloadMasked(masker.mask(env.payload(), env.eventType()));
        } catch (JsonProcessingException e) {
            a.setErrorDetails("Not a valid event envelope: " + trim(e.getOriginalMessage(), 300));
            a.setPayloadMasked(null);
        }
        audits.save(a);
    }

    /** A consumer group reported what it did with a message. Upsert per (event, group): attempts and status keep up to date. */
    @Transactional
    public void recordProcessing(ProcessingAudit p) {
        if (p.eventId() == null && p.topic() == null) return;
        String key = "C:" + (p.eventId() != null ? p.eventId() : p.topic() + "-" + p.partition() + "-" + p.offset()) + ":" + p.consumerGroup();
        EventAudit a = audits.findByDedupeKey(key).orElseGet(EventAudit::new);
        boolean isNew = a.getId() == null;
        a.setDedupeKey(key);
        a.setRole("CONSUMED");
        a.setEventId(p.eventId());
        a.setTopic(p.topic());
        a.setPartitionNo(p.partition());
        a.setOffsetNo(p.offset());
        a.setMsgKey(p.key());
        a.setEventType(p.eventType());
        a.setConsumerService(p.consumerService());
        a.setConsumerGroup(p.consumerGroup());
        a.setConsumerClass(p.consumerClass());
        // never downgrade a final state because of a late/out-of-order FAILED attempt report
        if (isNew || !isFinal(a.getStatus()) || isFinal(p.status())) a.setStatus(p.status());
        a.setAttempts(p.attempt() > 0 ? p.attempt() : a.getAttempts());
        a.setDurationMs(p.durationMs());
        a.setErrorDetails(trim(p.error(), 590));
        a.setProcessedAt(p.processedAt());
        a.setCorrelationId(p.correlationId());
        if (a.getEventTimestamp() == null) a.setEventTimestamp(p.processedAt());
        if (a.getPayloadMasked() == null && p.eventId() != null) {
            audits.findByEventIdOrderByIdAsc(p.eventId()).stream().filter(x -> "PUBLISHED".equals(x.getRole())).findFirst().ifPresent(pub -> {
                a.setPayloadMasked(pub.getPayloadMasked());
                a.setProducerService(pub.getProducerService());
                if (pub.getEventTimestamp() != null) a.setEventTimestamp(pub.getEventTimestamp());
            });
        }
        audits.save(a);
    }

    @Transactional
    public void recordTopology(TopologyEntry e) {
        TopologyEdge t = topology.findByServiceAndRoleAndTopicAndClassName(e.service(), e.role(), e.topic(), e.className()).orElseGet(TopologyEdge::new);
        t.setService(e.service());
        t.setRole(e.role());
        t.setTopic(e.topic());
        t.setGroupId(e.groupId());
        t.setClassName(e.className());
        t.setMethod(e.method());
        t.setLastSeen(Instant.now());
        topology.save(t);
    }

    private static boolean isFinal(String s) {
        return "PROCESSED".equals(s) || "DUPLICATE_IGNORED".equals(s) || "DEAD_LETTERED".equals(s) || "REJECTED_INVALID".equals(s);
    }

    private String headers(ConsumerRecord<String, String> rec) {
        Map<String, String> m = new LinkedHashMap<>();
        for (Header h : rec.headers()) {
            String k = h.key();
            if (k.equalsIgnoreCase("authorization")) continue;
            m.put(k, h.value() == null ? null : trim(new String(h.value(), StandardCharsets.UTF_8), 80));
        }
        try { return trim(mapper.writeValueAsString(m), 590); } catch (JsonProcessingException e) { return null; }
    }

    private static String trim(String s, int max) { return s == null ? null : s.length() <= max ? s : s.substring(0, max); }
}
