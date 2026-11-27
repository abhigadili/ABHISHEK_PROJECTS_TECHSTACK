package com.hrportal.common.kafka;

import java.util.ArrayList;
import java.util.List;

import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.common.TopicPartition;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.KafkaAdmin;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.CommonErrorHandler;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.util.backoff.ExponentialBackOff;

import com.hrportal.common.events.EventMetadata;
import com.hrportal.common.events.Topics;

import jakarta.annotation.PostConstruct;

/** Topic configuration (3 partitions each + a dead-letter twin) and the shared consumer error handler. */
@Configuration
@EnableScheduling
public class KafkaCommonConfig {
    private static final Logger log = LoggerFactory.getLogger(KafkaCommonConfig.class);
    private final String serviceName;

    public KafkaCommonConfig(@Value("${spring.application.name}") String serviceName) {
        this.serviceName = serviceName;
    }

    @PostConstruct
    void registerServiceName() {
        EventMetadata.SERVICE_NAME = serviceName;
    }

    /** Every service declares the full topic set; KafkaAdmin creates only the missing ones. */
    @Bean
    public KafkaAdmin.NewTopics hrTopics() {
        List<NewTopic> topics = new ArrayList<>();
        for (String t : Topics.ALL) {
            topics.add(TopicBuilder.name(t).partitions(3).replicas(1).build());
            topics.add(TopicBuilder.name(t + Topics.DLT_SUFFIX).partitions(3).replicas(1).build());
        }
        return new KafkaAdmin.NewTopics(topics.toArray(new NewTopic[0]));
    }

    /** Retry with exponential back-off (blocking, in-order), then park the record on "&lt;topic&gt;.DLT". */
    @Bean
    public CommonErrorHandler kafkaErrorHandler(KafkaTemplate<String, String> template) {
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(template,
                (record, ex) -> new TopicPartition(record.topic() + Topics.DLT_SUFFIX, record.partition()));
        ExponentialBackOff backOff = new ExponentialBackOff(500L, 2.0);
        backOff.setMaxElapsedTime(5_000L);
        DefaultErrorHandler handler = new DefaultErrorHandler((record, ex) -> {
            log.error("Giving up on {}-{}@{} -> dead-letter: {}", record.topic(), record.partition(), record.offset(), ex.toString());
            recoverer.accept(record, ex);
        }, backOff);
        handler.addNotRetryableExceptions(IllegalArgumentException.class);
        return handler;
    }
}
