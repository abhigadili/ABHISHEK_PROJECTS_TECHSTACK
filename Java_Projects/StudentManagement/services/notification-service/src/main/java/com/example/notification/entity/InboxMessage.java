package com.example.notification.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "sms_inbox_messages")
@Getter @Setter @NoArgsConstructor
public class InboxMessage {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "inbox_id")
    private Long inboxId;

    @Column(name = "message_id", nullable = false, length = 64)
    private String messageId;

    @Column(nullable = false, length = 100)
    private String topic;

    @Column(name = "consumer_group", nullable = false, length = 100)
    private String consumerGroup;

    @CreationTimestamp
    @Column(name = "received_at", nullable = false, updatable = false)
    private LocalDateTime receivedAt;

    public InboxMessage(String messageId, String topic, String consumerGroup) {
        this.messageId = messageId; this.topic = topic; this.consumerGroup = consumerGroup;
    }
}
