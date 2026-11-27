using StudentMgmt.BuildingBlocks.Contracts.Events;

namespace StudentMgmt.NotificationService.DTOs.Responses;

public class NotificationHistoryResponse
{
    public Guid Id { get; set; }
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
