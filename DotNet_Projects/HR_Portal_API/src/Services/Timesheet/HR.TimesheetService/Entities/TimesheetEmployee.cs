using System;
using System.Collections.Generic;

namespace HR.TimesheetService.Entities;

public partial class TimesheetEmployee
{
    public string EmployeeId { get; set; } = null!;

    public string? FullName { get; set; }

    public string? ManagerId { get; set; }

    public string Status { get; set; } = null!;

    public DateTime UpdatedAt { get; set; }
}
