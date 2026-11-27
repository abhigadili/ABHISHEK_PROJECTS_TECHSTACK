using System;
using System.Collections.Generic;

namespace HR.NotificationService.Entities;

public partial class EventHistory
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string? CorrelationId { get; set; }

    public string? EmployeeId { get; set; }

    public string EventId { get; set; } = null!;

    public string? EventType { get; set; }

    public DateTime OccurredAt { get; set; }

    public long OffsetNo { get; set; }

    public int PartitionNo { get; set; }

    public string? Payload { get; set; }

    public string? SourceService { get; set; }

    public string Topic { get; set; } = null!;
}
