namespace StudentMgmt.BuildingBlocks.Contracts.Events;

public enum NotificationChannel
{
    Email = 1,
    Sms = 2,
    Push = 3
}

/// <summary>
/// Raised by any upstream service (Student/Course/Enrollment) asking
/// notification-service to deliver a message. notification-service is the only
/// consumer of this event; it never gets produced by notification-service itself.
/// </summary>
public sealed class NotificationRequestedEvent : IntegrationEvent
{
    public NotificationChannel Channel { get; init; }
    public string RecipientEmail { get; init; } = default!;
    public string? RecipientPhoneNumber { get; init; }
    public string Subject { get; init; } = default!;
    public string Body { get; init; } = default!;
    public string TriggeredByEvent { get; init; } = default!;
    public Guid? ReferenceId { get; init; }
}

/// <summary>
/// Raised by notification-service once a NotificationRequestedEvent has been
/// processed (successfully or not) so upstream services/auditors can react to
/// delivery outcome without polling.
/// </summary>
public sealed class NotificationSentEvent : IntegrationEvent
{
    public Guid NotificationId { get; init; }
    public NotificationChannel Channel { get; init; }
    public string RecipientEmail { get; init; } = default!;
    public bool Success { get; init; }
    public string? FailureReason { get; init; }
    public DateTime SentOnUtc { get; init; }
}
