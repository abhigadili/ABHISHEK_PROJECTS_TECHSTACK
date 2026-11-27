package com.hrportal.notification.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import com.hrportal.common.validation.ValidEmployeeId;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class NotificationDtos {
    private NotificationDtos() {
    }

    public record NotificationResponse(String id, String recipientEmployeeId, String channel, String type, String subject, String body, String status, Instant readAt,
                                       Instant sentAt, String referenceType, String referenceId, Instant createdAt) { }

    public record UnreadCount(long unread) { }

    public record TemplateRequest(@NotBlank @Pattern(regexp = "^[A-Z][A-Z0-9_]{2,59}$", message = "code must be UPPER_SNAKE_CASE") String code, @NotBlank @Size(max = 200) String subjectTemplate,
                                  @NotBlank @Size(max = 2000) String bodyTemplate, @Size(max = 200) String description, Boolean active) { }

    public record TemplateResponse(String id, String code, String subjectTemplate, String bodyTemplate, String description, boolean active) { }

    public record EmailSettingRequest(@Pattern(regexp = "LOG|SMTP") String mode, Boolean enabled, @Size(max = 150) String host, @Min(1) @Max(65535) Integer port,
                                      @Size(max = 150) String username, Boolean startTls, @Email @Size(max = 150) String fromAddress) { }

    public record EmailSettingResponse(String mode, boolean enabled, String host, Integer port, String username, boolean startTls, String fromAddress, boolean passwordConfigured) { }

    public record SendRequest(@NotBlank @ValidEmployeeId String employeeId, @NotBlank @Size(max = 200) String subject, @NotBlank @Size(max = 1500) String message,
                              List<String> channels) { }

    public record EventHistoryResponse(String id, String eventId, String topic, String eventType, String employeeId, String sourceService, String correlationId, Instant occurredAt,
                                       int partitionNo, long offsetNo, String payload) { }

    public record TopicInfo(String topic, int partitions, long messages, boolean deadLetter) { }

    public record KafkaOverview(String bootstrapServers, int topicCount, List<TopicInfo> topics) { }

    public record TemplatePreviewRequest(@NotEmpty Map<String, String> params) { }
}
