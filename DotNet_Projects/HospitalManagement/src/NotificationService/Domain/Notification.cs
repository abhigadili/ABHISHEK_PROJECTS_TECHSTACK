namespace HMS.Notifications.Domain;

public enum Channel { EMAIL, SMS }
public enum NotificationStatus { PENDING, SENT, FAILED }

public class Notification
{
    public long Id { get; set; }
    public string RecipientEmail { get; set; } = "";
    public string? RecipientPhone { get; set; }
    public Channel Channel { get; set; } = Channel.EMAIL;
    public string Subject { get; set; } = "";
    public string Message { get; set; } = "";
    public string EventType { get; set; } = "";
    public string? ReferenceId { get; set; }
    public NotificationStatus Status { get; set; } = NotificationStatus.PENDING;
    public int Attempts { get; set; }
    public string? FailureReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SentAt { get; set; }
}
