namespace NotificationService.Entities;

public enum NotificationType { EnrollmentConfirmed, EnrollmentRejected, EnrollmentCancelled, CourseLowAvailability }
/// <summary>Pending = waiting for first attempt or a retry (see NextAttemptAt); Sent; Failed = retries exhausted or permanent error.</summary>
public enum NotificationStatus { Pending, Sent, Failed }

public class Notification
{
    public long NotificationId { get; set; }
    public long? StudentId { get; set; }          // logical reference to StudentDB (no cross-database FK)
    public long? EnrollmentId { get; set; }       // logical reference to EnrollmentDB
    public NotificationType NotificationType { get; set; }
    public string? RecipientEmail { get; set; }
    public string Message { get; set; } = "";
    public NotificationStatus Status { get; set; } = NotificationStatus.Pending;
    public int RetryCount { get; set; }
    public DateTime? NextAttemptAt { get; set; }
    public string? LastError { get; set; }
    public long Version { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ProcessedAt { get; set; }
}

/// <summary>Inbox / processed-message table: one row per consumed message id → duplicate deliveries are ignored.</summary>
public class InboxMessage
{
    public long InboxId { get; set; }
    public string MessageId { get; set; } = "";
    public string Queue { get; set; } = "";
    public string ConsumerGroup { get; set; } = "";
    public DateTime ReceivedAt { get; set; }
}
