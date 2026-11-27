package com.fooddelivery.notification.web;

import com.fooddelivery.notification.domain.Notification;

import java.time.Instant;
import java.util.Map;

public final class Dtos {
    private Dtos() {}

    public record NotificationDto(Long id, String title, String message, String type, String channel, String status, boolean read,
                                  String referenceType, Long referenceId, Instant createdAt, Instant readAt) {
        public static NotificationDto from(Notification n) {
            return new NotificationDto(n.getId(), n.getTitle(), n.getMessage(), n.getType(), n.getChannel().name(), n.getStatus().name(), n.isReadFlag(),
                    n.getReferenceType(), n.getReferenceId(), n.getCreatedAt(), n.getReadAt());
        }
    }
    public record UnreadCount(long unread) {}
    public record Stats(Map<String, Long> byChannelAndStatus) {}
}
