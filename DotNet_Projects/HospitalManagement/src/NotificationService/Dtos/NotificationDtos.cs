using System.ComponentModel.DataAnnotations;
using HMS.Notifications.Domain;

namespace HMS.Notifications.Dtos;

public sealed class SendRequest
{
    [Required, EmailAddress] public string RecipientEmail { get; set; } = "";
    [StringLength(20)] public string? RecipientPhone { get; set; }
    [Required, StringLength(200)] public string Subject { get; set; } = "";
    [Required, StringLength(2000)] public string Message { get; set; } = "";
}

public sealed record NotificationResponse(long Id, string RecipientEmail, Channel Channel, string Subject, string Message, string EventType, string? ReferenceId,
    NotificationStatus Status, DateTime CreatedAt, DateTime? SentAt)
{
    public static NotificationResponse From(Notification n) => new(n.Id, n.RecipientEmail, n.Channel, n.Subject, n.Message, n.EventType, n.ReferenceId, n.Status, n.CreatedAt, n.SentAt);
}
