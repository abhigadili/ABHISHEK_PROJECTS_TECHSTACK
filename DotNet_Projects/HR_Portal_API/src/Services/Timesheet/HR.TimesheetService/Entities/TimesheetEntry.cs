using System;
using System.Collections.Generic;

namespace HR.TimesheetService.Entities;

public partial class TimesheetEntry
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public bool Billable { get; set; }

    public string? Description { get; set; }

    public string EmployeeId { get; set; } = null!;

    public decimal Hours { get; set; }

    public string ProjectId { get; set; } = null!;

    public string? ProjectManagerId { get; set; }

    public string? TaskId { get; set; }

    public string TaskKey { get; set; } = null!;

    public string TimesheetId { get; set; } = null!;

    public DateOnly WorkDate { get; set; }

    public virtual Timesheet Timesheet { get; set; } = null!;
}
