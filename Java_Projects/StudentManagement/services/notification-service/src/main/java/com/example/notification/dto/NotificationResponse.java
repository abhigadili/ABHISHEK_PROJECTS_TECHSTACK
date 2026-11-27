package com.example.notification.dto;

import com.example.notification.entity.NotificationStatus;
import com.example.notification.entity.NotificationType;
import java.time.LocalDateTime;

public record NotificationResponse(Long notificationId, Long studentId, Long enrollmentId, NotificationType notificationType,
                                   String recipientEmail, String message, NotificationStatus status, int retryCount,
                                   String lastError, LocalDateTime createdAt, LocalDateTime processedAt) {
}
