using System;
using System.Collections.Generic;

namespace HR.PayrollService.Entities;

public partial class AuditHistory
{
    public string Id { get; set; } = null!;

    public string Action { get; set; } = null!;

    public string? CorrelationId { get; set; }

    public DateTime CreatedAt { get; set; }

    public string EntityId { get; set; } = null!;

    public string EntityType { get; set; } = null!;

    public string? NewValue { get; set; }

    public string? PreviousValue { get; set; }

    public string? UserId { get; set; }
}
