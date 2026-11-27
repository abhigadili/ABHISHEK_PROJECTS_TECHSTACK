using System;
using System.Collections.Generic;

namespace HR.EmployeeService.Entities;

public partial class EmploymentHistory
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string ChangeType { get; set; } = null!;

    public DateOnly EffectiveDate { get; set; }

    public string EmployeeId { get; set; } = null!;

    public string? FromValue { get; set; }

    public string? Reason { get; set; }

    public string? ToValue { get; set; }
}
