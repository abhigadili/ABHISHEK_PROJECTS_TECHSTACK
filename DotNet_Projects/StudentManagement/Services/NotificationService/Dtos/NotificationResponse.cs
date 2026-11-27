using NotificationService.Entities;

namespace NotificationService.Dtos;

public record NotificationResponse(long NotificationId, long? StudentId, long? EnrollmentId, NotificationType NotificationType, string? RecipientEmail,
    string Message, NotificationStatus Status, int RetryCount, string? LastError, DateTime CreatedAt, DateTime? ProcessedAt);
