package com.example.enrollment.config;

import com.example.events.Topics;
import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.KafkaAdmin;

@Configuration
public class KafkaConfig {
    @Bean
    KafkaAdmin.NewTopics enrollmentTopics() {
        NewTopic[] topics = java.util.Arrays.stream(Topics.ENROLLMENT_TOPICS)
                .map(t -> TopicBuilder.name(t).partitions(3).replicas(1).build()).toArray(NewTopic[]::new);
        return new KafkaAdmin.NewTopics(topics);
    }
}
