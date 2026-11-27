package com.hospital.common.kafka;

import java.util.ArrayList;
import java.util.List;

import org.apache.kafka.common.TopicPartition;
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

import com.hospital.common.events.Topics;

import lombok.extern.log4j.Log4j2;

@Log4j2
@Configuration
@EnableScheduling
public class KafkaCommonConfig {

    /** Every service declares the full topic set; KafkaAdmin creates only the missing ones. */
    @Bean
    public KafkaAdmin.NewTopics hospitalTopics() {
        List<org.apache.kafka.clients.admin.NewTopic> topics = new ArrayList<>();
        for (String t : Topics.ALL) {
            topics.add(TopicBuilder.name(t).partitions(3).replicas(1).build());
            topics.add(TopicBuilder.name(t + ".DLT").partitions(3).replicas(1).build());
        }
        return new KafkaAdmin.NewTopics(topics.toArray(new org.apache.kafka.clients.admin.NewTopic[0]));
    }

    /** Retry 3x with exponential back-off, then park the record on "<topic>.DLT". */
    @Bean
    public CommonErrorHandler kafkaErrorHandler(KafkaTemplate<String, String> template) {
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(template,
                (record, ex) -> new TopicPartition(record.topic() + ".DLT", record.partition()));
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
