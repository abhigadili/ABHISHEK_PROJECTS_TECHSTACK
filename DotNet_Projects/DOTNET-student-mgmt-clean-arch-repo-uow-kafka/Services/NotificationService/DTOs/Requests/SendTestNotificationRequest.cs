using StudentMgmt.BuildingBlocks.Contracts.Events;

namespace StudentMgmt.NotificationService.DTOs.Requests;

public class SendTestNotificationRequest
{
    public NotificationChannel Channel { get; set; }
    public string RecipientEmail { get; set; } = default!;
    public string? RecipientPhoneNumber { get; set; }
    public string Subject { get; set; } = default!;
    public string Body { get; set; } = default!;
}
