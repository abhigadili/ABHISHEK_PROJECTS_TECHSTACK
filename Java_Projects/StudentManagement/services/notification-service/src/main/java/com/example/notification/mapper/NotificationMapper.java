package com.example.notification.mapper;

import com.example.notification.dto.NotificationResponse;
import com.example.notification.entity.Notification;
import org.springframework.stereotype.Component;

@Component
public class NotificationMapper {
    public NotificationResponse toResponse(Notification n) {
        return new NotificationResponse(n.getNotificationId(), n.getStudentId(), n.getEnrollmentId(), n.getNotificationType(),
                n.getRecipientEmail(), n.getMessage(), n.getStatus(), n.getRetryCount(), n.getLastError(), n.getCreatedAt(), n.getProcessedAt());
    }
}
