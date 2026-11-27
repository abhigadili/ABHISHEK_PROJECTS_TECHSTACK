using System;
using System.Collections.Generic;

namespace HR.PayrollService.Entities;

public partial class PayrollAdjustment
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public decimal Amount { get; set; }

    public string? AppliedRunId { get; set; }

    public string? Description { get; set; }

    public string EmployeeId { get; set; } = null!;

    public string PayrollMonth { get; set; } = null!;

    public string? ReferenceId { get; set; }

    public string Status { get; set; } = null!;

    public string Type { get; set; } = null!;
}
