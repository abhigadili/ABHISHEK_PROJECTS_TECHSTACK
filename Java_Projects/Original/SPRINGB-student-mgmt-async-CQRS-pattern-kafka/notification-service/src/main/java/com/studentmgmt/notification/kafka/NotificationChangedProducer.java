package com.studentmgmt.notification.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studentmgmt.notification.event.NotificationChangedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
public class NotificationChangedProducer {

    private static final Logger log = LoggerFactory.getLogger(NotificationChangedProducer.class);

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    @Value("${app.kafka.topic.notification-changed}")
    private String notificationChangedTopic;

    public NotificationChangedProducer(KafkaTemplate<String, String> kafkaTemplate, ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    public void publish(NotificationChangedEvent event) {
        try {
            String payload = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(notificationChangedTopic, String.valueOf(event.getNotificationId()), payload);
            log.info("Published to {}: {}", notificationChangedTopic, payload);
        } catch (Exception e) {
            log.error("Failed to publish NotificationChangedEvent for notificationId={}", event.getNotificationId(), e);
        }
    }
}
