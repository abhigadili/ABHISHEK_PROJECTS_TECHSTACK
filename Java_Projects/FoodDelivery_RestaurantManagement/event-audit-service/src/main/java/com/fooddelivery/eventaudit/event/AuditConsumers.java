package com.fooddelivery.eventaudit.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fooddelivery.common.kafka.ProcessingAudit;
import com.fooddelivery.common.kafka.Topics;
import com.fooddelivery.common.kafka.TopologyEntry;
import com.fooddelivery.eventaudit.service.AuditIngestService;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * The audit sink. Three listeners in group "event-audit-service-group":
 * <ul>
 *   <li>every business topic (list taken from the topic catalogue) -> "PUBLISHED" history;</li>
 *   <li>{@code audit.event-processing} -> what each consumer group did with each message (the truth about consumption);</li>
 *   <li>{@code audit.topology} -> the producer/consumer map announced by each service at startup.</li>
 * </ul>
 * Malformed messages are logged and skipped: an audit sink must never get stuck on a poison message.
 */
@Component
public class AuditConsumers {
    private static final Logger log = LoggerFactory.getLogger(AuditConsumers.class);
    private final AuditIngestService ingest;
    private final ObjectMapper mapper;

    public AuditConsumers(AuditIngestService ingest, ObjectMapper mapper) {
        this.ingest = ingest;
        this.mapper = mapper;
    }

    @KafkaListener(topics = "#{T(com.fooddelivery.common.kafka.Topics).allBusinessTopics()}", groupId = "${spring.application.name}-group")
    public void published(ConsumerRecord<String, String> rec) {
        try { ingest.recordPublished(rec); }
        catch (Exception e) { log.error("Could not audit message {}-{}@{}: {}", rec.topic(), rec.partition(), rec.offset(), e.toString()); }
    }

    @KafkaListener(topics = Topics.AUDIT_PROCESSING, groupId = "${spring.application.name}-group")
    public void processing(ConsumerRecord<String, String> rec) {
        try { ingest.recordProcessing(mapper.readValue(rec.value(), ProcessingAudit.class)); }
        catch (Exception e) { log.error("Could not audit processing record at offset {}: {}", rec.offset(), e.toString()); }
    }

    @KafkaListener(topics = Topics.AUDIT_TOPOLOGY, groupId = "${spring.application.name}-group")
    public void topology(ConsumerRecord<String, String> rec) {
        try { ingest.recordTopology(mapper.readValue(rec.value(), TopologyEntry.class)); }
        catch (Exception e) { log.error("Could not store topology entry at offset {}: {}", rec.offset(), e.toString()); }
    }
}
