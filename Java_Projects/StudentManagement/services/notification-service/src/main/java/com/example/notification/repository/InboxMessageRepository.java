package com.example.notification.repository;

import com.example.notification.entity.InboxMessage;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InboxMessageRepository extends JpaRepository<InboxMessage, Long> {
    boolean existsByMessageIdAndConsumerGroup(String messageId, String consumerGroup);
}
