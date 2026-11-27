using System;
using System.Collections.Generic;

namespace HR.PayrollService.Entities;

public partial class SalaryRevisionHistory
{
    public long Id { get; set; }

    public string Action { get; set; } = null!;

    public DateTime ChangedAt { get; set; }

    public string? ChangedBy { get; set; }

    public DateOnly? EffectiveFrom { get; set; }

    public string EmployeeId { get; set; } = null!;

    public decimal? NewCtc { get; set; }

    public string? NewStatus { get; set; }

    public decimal? OldCtc { get; set; }

    public string? OldStatus { get; set; }

    public string SalaryId { get; set; } = null!;
}
