using StudentMgmt.BuildingBlocks.Common.Entities;
using StudentMgmt.BuildingBlocks.Contracts.Events;

namespace StudentMgmt.NotificationService.Entities;

/// <summary>
/// Durable record of every notification NotificationService ever attempted to
/// deliver, whether triggered by an upstream Kafka event or a manual test-send.
/// Success/FailureReason reflect the real outcome of the corresponding mock
/// sender (IEmailSender/ISmsSender/IPushSender).
/// </summary>
public class NotificationHistory : BaseEntity
{
    public NotificationChannel Channel { get; set; }
    public string RecipientEmail { get; set; } = default!;
    public string? RecipientPhoneNumber { get; set; }
    public string Subject { get; set; } = default!;
    public string Body { get; set; } = default!;
    public bool Success { get; set; }
    public string? FailureReason { get; set; }
    public DateTime SentOnUtc { get; set; }
    public string TriggeredByEvent { get; set; } = default!;
    public Guid? ReferenceId { get; set; }
}
