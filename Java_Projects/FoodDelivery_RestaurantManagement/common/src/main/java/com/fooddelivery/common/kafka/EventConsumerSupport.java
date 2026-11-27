package com.fooddelivery.common.kafka;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fooddelivery.common.exception.InvalidEventException;
import com.fooddelivery.common.kafka.outbox.ProcessedEvent;
import com.fooddelivery.common.kafka.outbox.ProcessedEventRepository;
import com.fooddelivery.common.web.Correlation;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.common.header.Header;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.BiConsumer;

/**
 * The single place where a consumed Kafka record becomes a business call:
 * <ol>
 *   <li>parse + validate the envelope (invalid -> {@link InvalidEventException}, not retried, dead-lettered);</li>
 *   <li>restore the correlation id into the MDC;</li>
 *   <li>inside ONE database transaction: duplicate check on the idempotency ledger, then the business handler;
 *       a failing handler rolls the ledger row back so a retry can succeed;</li>
 *   <li>publish a processing-audit record (PROCESSED / DUPLICATE_IGNORED / FAILED / REJECTED_INVALID).</li>
 * </ol>
 */
@Component
public class EventConsumerSupport {
    private static final Logger log = LoggerFactory.getLogger(EventConsumerSupport.class);
    private final ObjectMapper mapper;
    private final ProcessedEventRepository processed;
    private final TransactionTemplate tx;
    private final AuditPublisher audit;
    private final String service;
    private final Map<String, Integer> attempts = new ConcurrentHashMap<>();

    public EventConsumerSupport(ObjectMapper mapper, ProcessedEventRepository processed, TransactionTemplate tx,
                                AuditPublisher audit, @Value("${spring.application.name}") String service) {
        this.mapper = mapper;
        this.processed = processed;
        this.tx = tx;
        this.audit = audit;
        this.service = service;
    }

    public String group() { return service + "-group"; }

    public <P> void handle(ConsumerRecord<String, String> rec, String consumerClass, Class<P> payloadType,
                           BiConsumer<EventEnvelope, P> handler) {
        long start = System.nanoTime();
        String attemptKey = rec.topic() + "-" + rec.partition() + "-" + rec.offset();
        int attempt = attempts.merge(attemptKey, 1, Integer::sum);
        EventEnvelope env = null;
        try {
            env = parse(rec);
            MDC.put(Correlation.MDC_KEY, env.correlationId() == null ? "" : env.correlationId());
            MDC.put("eventId", env.eventId());
            log.info("Kafka consumed {} topic={} partition={} offset={} key={}", env.eventType(), rec.topic(), rec.partition(), rec.offset(), rec.key());
            final EventEnvelope e = env;
            P payload = e.payloadAs(mapper, payloadType);
            Boolean first = tx.execute(s -> {
                if (processed.existsByEventIdAndConsumerGroup(e.eventId(), group())) return false;
                processed.saveAndFlush(new ProcessedEvent(e.eventId(), group(), rec.topic()));
                handler.accept(e, payload);
                return true;
            });
            boolean ok = Boolean.TRUE.equals(first);
            if (!ok) log.info("Duplicate event ignored eventId={} (already processed by {})", env.eventId(), group());
            send(rec, env, consumerClass, ok ? ProcessingAudit.PROCESSED : ProcessingAudit.DUPLICATE_IGNORED, attempt, start, null);
            attempts.remove(attemptKey);
        } catch (InvalidEventException ex) {
            send(rec, env, consumerClass, ProcessingAudit.REJECTED_INVALID, attempt, start, ex.getMessage());
            attempts.remove(attemptKey);
            throw ex;
        } catch (JsonProcessingException ex) {
            String m = "Payload does not match contract for " + payloadType.getSimpleName() + ": " + ex.getOriginalMessage();
            send(rec, env, consumerClass, ProcessingAudit.REJECTED_INVALID, attempt, start, m);
            attempts.remove(attemptKey);
            throw new InvalidEventException(m, ex);
        } catch (RuntimeException ex) {
            log.error("Kafka handler failed for topic={} offset={} (attempt {}): {}", rec.topic(), rec.offset(), attempt, ex.getMessage());
            send(rec, env, consumerClass, ProcessingAudit.FAILED, attempt, start, ex.toString());
            throw ex;       // DefaultErrorHandler: back-off retries, then dead-letter topic
        } finally {
            MDC.remove("eventId");
            MDC.remove(Correlation.MDC_KEY);
        }
    }

    private EventEnvelope parse(ConsumerRecord<String, String> rec) {
        if (rec.value() == null || rec.value().isBlank()) throw new InvalidEventException("Empty message value");
        EventEnvelope env;
        try {
            env = mapper.readValue(rec.value(), EventEnvelope.class);
        } catch (JsonProcessingException e) {
            throw new InvalidEventException("Message is not a valid event envelope: " + e.getOriginalMessage(), e);
        }
        if (env.eventId() == null || env.eventType() == null || env.payload() == null || env.payload().isNull()) {
            throw new InvalidEventException("Envelope is missing eventId/eventType/payload");
        }
        if (env.eventVersion() == null || !env.eventVersion().startsWith("1.")) {
            throw new InvalidEventException("Unsupported event version " + env.eventVersion());
        }
        return env;
    }

    private void send(ConsumerRecord<String, String> rec, EventEnvelope env, String consumerClass, String status,
                      int attempt, long startNanos, String error) {
        boolean replay = false;
        Header h = rec.headers().lastHeader("x-replay");
        if (h != null) replay = true;
        audit.send(new ProcessingAudit(env == null ? null : env.eventId(), env == null ? null : env.eventType(), rec.topic(),
                rec.partition(), rec.offset(), rec.key(), service, group(), consumerClass, status, attempt,
                (System.nanoTime() - startNanos) / 1_000_000, error, Instant.now(),
                env == null ? null : env.correlationId(), replay));
    }
}
