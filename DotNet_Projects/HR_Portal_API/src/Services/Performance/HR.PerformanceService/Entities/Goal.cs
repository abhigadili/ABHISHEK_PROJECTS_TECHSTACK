using System;
using System.Collections.Generic;

namespace HR.PerformanceService.Entities;

public partial class Goal
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public bool Deleted { get; set; }

    public DateTime? DeletedAt { get; set; }

    public string? CycleId { get; set; }

    public string? Description { get; set; }

    public string EmployeeId { get; set; } = null!;

    public int Progress { get; set; }

    public string Status { get; set; } = null!;

    public DateOnly? TargetDate { get; set; }

    public string Title { get; set; } = null!;

    public string Type { get; set; } = null!;

    public int Weight { get; set; }

    public virtual ICollection<KeyResult> KeyResults { get; set; } = new List<KeyResult>();
}
