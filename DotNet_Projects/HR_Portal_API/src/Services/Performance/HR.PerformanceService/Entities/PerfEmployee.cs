using System;
using System.Collections.Generic;

namespace HR.PerformanceService.Entities;

public partial class PerfEmployee
{
    public string EmployeeId { get; set; } = null!;

    public string? DepartmentId { get; set; }

    public string? FullName { get; set; }

    public string? ManagerId { get; set; }

    public string Status { get; set; } = null!;

    public DateTime UpdatedAt { get; set; }
}
