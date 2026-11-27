package com.example.course.config;

import com.example.events.Topics;
import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaConfig {
    @Bean
    NewTopic lowAvailabilityTopic() { return TopicBuilder.name(Topics.COURSE_LOW_AVAILABILITY).partitions(3).replicas(1).build(); }
}
