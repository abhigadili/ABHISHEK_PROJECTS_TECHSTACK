using System;
using System.Collections.Generic;

namespace HR.NotificationService.Entities;

public partial class Notification
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string Body { get; set; } = null!;

    public string Channel { get; set; } = null!;

    public string? CorrelationId { get; set; }

    public string? ErrorMessage { get; set; }

    public DateTime? ReadAt { get; set; }

    public string? RecipientEmail { get; set; }

    public string? RecipientEmployeeId { get; set; }

    public string? ReferenceId { get; set; }

    public string? ReferenceType { get; set; }

    public DateTime? SentAt { get; set; }

    public string Status { get; set; } = null!;

    public string Subject { get; set; } = null!;

    public string Type { get; set; } = null!;
}
