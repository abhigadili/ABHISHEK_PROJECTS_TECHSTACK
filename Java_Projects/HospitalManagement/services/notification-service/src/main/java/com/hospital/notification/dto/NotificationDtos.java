package com.hospital.notification.dto;

import java.time.Instant;

import com.hospital.notification.domain.Notification;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

public final class NotificationDtos {
    private NotificationDtos() {
    }

    @Data
    public static class SendRequest {
        @NotBlank @Email private String recipientEmail;
        @Size(max = 20) private String recipientPhone;
        @NotBlank @Size(max = 200) private String subject;
        @NotBlank @Size(max = 2000) private String message;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class NotificationResponse {
        private Long id;
        private String recipientEmail;
        private Notification.Channel channel;
        private String subject;
        private String message;
        private String eventType;
        private String referenceId;
        private Notification.Status status;
        private Instant createdAt;
        private Instant sentAt;

        public static NotificationResponse from(Notification n) {
            return new NotificationResponse(n.getId(), n.getRecipientEmail(), n.getChannel(), n.getSubject(), n.getMessage(), n.getEventType(),
                    n.getReferenceId(), n.getStatus(), n.getCreatedAt(), n.getSentAt());
        }
    }
}
