using System;
using System.Collections.Generic;

namespace HR.PayrollService.Entities;

public partial class SalaryRevision
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public DateTime? DecidedAt { get; set; }

    public string? DecidedBy { get; set; }

    public string? DecisionComment { get; set; }

    public DateOnly EffectiveFrom { get; set; }

    public string EmployeeId { get; set; } = null!;

    public decimal NewCtc { get; set; }

    public string? NewStructureId { get; set; }

    public decimal OldCtc { get; set; }

    public string Reason { get; set; } = null!;

    public string Status { get; set; } = null!;
}
