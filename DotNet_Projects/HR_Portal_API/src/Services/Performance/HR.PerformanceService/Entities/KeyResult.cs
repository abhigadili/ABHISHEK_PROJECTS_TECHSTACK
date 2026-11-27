using System;
using System.Collections.Generic;

namespace HR.PerformanceService.Entities;

public partial class KeyResult
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public decimal CurrentValue { get; set; }

    public string Description { get; set; } = null!;

    public string GoalId { get; set; } = null!;

    public decimal TargetValue { get; set; }

    public string? Unit { get; set; }

    public virtual Goal Goal { get; set; } = null!;
}
