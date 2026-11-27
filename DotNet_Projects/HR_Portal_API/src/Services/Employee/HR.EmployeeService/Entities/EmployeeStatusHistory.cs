using System;
using System.Collections.Generic;

namespace HR.EmployeeService.Entities;

public partial class EmployeeStatusHistory
{
    public long Id { get; set; }

    public DateTime ChangedAt { get; set; }

    public string? ChangedBy { get; set; }

    public string EmployeeId { get; set; } = null!;

    public string NewStatus { get; set; } = null!;

    public string? OldStatus { get; set; }
}
