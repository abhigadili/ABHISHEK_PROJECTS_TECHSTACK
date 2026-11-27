package com.example.notification.config;

import com.example.events.Topics;
import java.util.LinkedHashMap;
import java.util.Map;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.common.serialization.ByteArraySerializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.kafka.KafkaProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaOperations;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.ExponentialBackOff;

@Configuration
public class KafkaConfig {
    private static final Logger log = LoggerFactory.getLogger(KafkaConfig.class);
    private static final String[] SOURCE_TOPICS = {Topics.ENROLLMENT_REQUESTED, Topics.ENROLLMENT_CONFIRMED,
            Topics.ENROLLMENT_REJECTED, Topics.ENROLLMENT_CANCELLED, Topics.COURSE_LOW_AVAILABILITY};

    /** Consumers declare the topics too, so they exist even if this service starts before the producers. Dead-letter topics live here. */
    @Bean
    org.springframework.kafka.core.KafkaAdmin.NewTopics topics() {
        java.util.List<NewTopic> all = new java.util.ArrayList<>();
        for (String t : SOURCE_TOPICS) {
            all.add(TopicBuilder.name(t).partitions(3).replicas(1).build());
            all.add(TopicBuilder.name(t + Topics.DLT_SUFFIX).partitions(3).replicas(1).build());
        }
        return new org.springframework.kafka.core.KafkaAdmin.NewTopics(all.toArray(new NewTopic[0]));
    }

    /** Declared explicitly because defining the byte[] template below makes Boot back off its default template. */
    @Bean
    KafkaTemplate<String, Object> jsonKafkaTemplate(org.springframework.kafka.core.ProducerFactory<String, Object> pf) {
        return new KafkaTemplate<>(pf);
    }

    @Bean
    KafkaTemplate<String, byte[]> bytesKafkaTemplate(KafkaProperties props) {
        Map<String, Object> cfg = new LinkedHashMap<>(props.buildProducerProperties(null));
        cfg.put("key.serializer", StringSerializer.class);
        cfg.put("value.serializer", ByteArraySerializer.class);
        cfg.remove("spring.json.add.type.headers");
        return new KafkaTemplate<>(new DefaultKafkaProducerFactory<>(cfg));
    }

    /** Retry with exponential back-off, then dead-letter to "<topic>.DLT" (poison/undeserializable records go straight there). */
    @Bean
    DefaultErrorHandler kafkaErrorHandler(KafkaTemplate<String, Object> jsonTemplate, KafkaTemplate<String, byte[]> bytesTemplate,
                                          @Value("${notification.consumer.retry-initial-ms:1000}") long initial,
                                          @Value("${notification.consumer.retry-multiplier:2.0}") double multiplier,
                                          @Value("${notification.consumer.retry-max-elapsed-ms:15000}") long maxElapsed) {
        Map<Class<?>, KafkaOperations<?, ?>> templates = new LinkedHashMap<>();
        templates.put(byte[].class, bytesTemplate);
        templates.put(Object.class, jsonTemplate);
        // Explicit destination "<topic>.DLT" (same partition): Spring's default would be "<topic>-dlt", which we do not create.
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(templates,
                (rec, ex) -> new org.apache.kafka.common.TopicPartition(rec.topic() + Topics.DLT_SUFFIX, rec.partition()));
        ExponentialBackOff backOff = new ExponentialBackOff(initial, multiplier);
        backOff.setMaxElapsedTime(maxElapsed);
        DefaultErrorHandler handler = new DefaultErrorHandler((rec, ex) -> {
            log.error("Dead-lettering {}-{}@{} after retries: {}", rec.topic(), rec.partition(), rec.offset(), ex.getMessage());
            recoverer.accept(rec, ex);
        }, backOff);
        return handler;
    }
}
