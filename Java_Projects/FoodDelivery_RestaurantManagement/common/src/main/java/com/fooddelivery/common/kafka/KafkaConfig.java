package com.fooddelivery.common.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fooddelivery.common.exception.InvalidEventException;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.config.TopicConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Role;
import org.springframework.context.event.EventListener;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.KafkaAdmin;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.CommonErrorHandler;
import org.springframework.kafka.listener.ConsumerRecordRecoverer;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.kafka.support.ExponentialBackOffWithMaxRetries;
import org.springframework.kafka.support.serializer.DeserializationException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Kafka wiring shared by all services: topic catalogue, retry back-off and the dead-letter topic ("&lt;topic&gt;.DLT").
 * Failed records are retried 3 times with exponential back-off (0.5 s, 1 s, 2 s); invalid events skip the retries.
 */
@Configuration
public class KafkaConfig {
    private static final Logger log = LoggerFactory.getLogger(KafkaConfig.class);

    @Bean
    public KafkaAdmin.NewTopics foodTopics(@Value("${food.kafka.partitions:3}") int partitions,
                                           @Value("${food.kafka.replicas:1}") int replicas,
                                           @Value("${food.kafka.retention-ms:604800000}") long retentionMs) {
        List<NewTopic> topics = new ArrayList<>();
        for (String t : Topics.allBusinessTopics()) {
            topics.add(TopicBuilder.name(t).partitions(partitions).replicas(replicas)
                    .config(TopicConfig.RETENTION_MS_CONFIG, String.valueOf(retentionMs)).build());
            topics.add(TopicBuilder.name(t + ".DLT").partitions(1).replicas(replicas)
                    .config(TopicConfig.RETENTION_MS_CONFIG, String.valueOf(retentionMs * 4)).build());
        }
        topics.add(TopicBuilder.name(Topics.AUDIT_PROCESSING).partitions(partitions).replicas(replicas)
                .config(TopicConfig.RETENTION_MS_CONFIG, String.valueOf(retentionMs)).build());
        topics.add(TopicBuilder.name(Topics.AUDIT_TOPOLOGY).partitions(1).replicas(replicas)
                .config(TopicConfig.RETENTION_MS_CONFIG, String.valueOf(retentionMs)).build());
        return new KafkaAdmin.NewTopics(topics.toArray(NewTopic[]::new));
    }

    @Bean
    public CommonErrorHandler kafkaErrorHandler(KafkaTemplate<String, String> template, AuditPublisher audit,
                                                TopologyRegistry topology, @Value("${spring.application.name}") String service) {
        DeadLetterPublishingRecoverer dlt = new DeadLetterPublishingRecoverer(template,
                (rec, ex) -> new TopicPartition(rec.topic() + ".DLT", -1));
        ConsumerRecordRecoverer recoverer = (rec, ex) -> {
            log.error("Dead-lettering record topic={} partition={} offset={}: {}", rec.topic(), rec.partition(), rec.offset(), ex.getMessage());
            audit.send(new ProcessingAudit(header(rec, "eventId"), header(rec, "eventType"), rec.topic(), rec.partition(), rec.offset(),
                    rec.key() == null ? null : rec.key().toString(), service, service + "-group", topology.consumerClassFor(rec.topic()),
                    ProcessingAudit.DEAD_LETTERED, 0, 0, String.valueOf(ex.getCause() != null ? ex.getCause() : ex),
                    Instant.now(), header(rec, "X-Correlation-Id"), false));
            dlt.accept(rec, ex);
        };
        ExponentialBackOffWithMaxRetries backOff = new ExponentialBackOffWithMaxRetries(3);
        backOff.setInitialInterval(500);
        backOff.setMultiplier(2.0);
        backOff.setMaxInterval(4000);
        DefaultErrorHandler handler = new DefaultErrorHandler(recoverer, backOff);
        handler.addNotRetryableExceptions(InvalidEventException.class, DeserializationException.class);
        return handler;
    }

    private static String header(org.apache.kafka.clients.consumer.ConsumerRecord<?, ?> rec, String name) {
        var h = rec.headers().lastHeader(name);
        return h == null ? null : new String(h.value(), java.nio.charset.StandardCharsets.UTF_8);
    }

    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    public static TopologyRegistry topologyRegistry() { return new TopologyRegistry(); }

    /** Announces this service's real producers/consumers to the event-audit service once it is up. */
    @Bean
    public TopologyPublisher topologyPublisher(TopologyRegistry registry, KafkaTemplate<String, String> kafka,
                                               ObjectMapper mapper) {
        return new TopologyPublisher(registry, kafka, mapper);
    }

    public static class TopologyPublisher {
        private final TopologyRegistry registry;
        private final KafkaTemplate<String, String> kafka;
        private final ObjectMapper mapper;

        TopologyPublisher(TopologyRegistry registry, KafkaTemplate<String, String> kafka, ObjectMapper mapper) {
            this.registry = registry;
            this.kafka = kafka;
            this.mapper = mapper;
        }

        @EventListener(ApplicationReadyEvent.class)
        public void publish() {
            for (TopologyEntry e : registry.entries()) {
                try {
                    String key = e.service() + "|" + e.role() + "|" + e.topic() + "|" + e.className();
                    kafka.send(Topics.AUDIT_TOPOLOGY, key, mapper.writeValueAsString(e));
                } catch (Exception ex) {
                    log.warn("Could not announce topology entry {}: {}", e, ex.getMessage());
                }
            }
            log.info("Announced {} producer/consumer topology entries", registry.entries().size());
        }
    }
}
