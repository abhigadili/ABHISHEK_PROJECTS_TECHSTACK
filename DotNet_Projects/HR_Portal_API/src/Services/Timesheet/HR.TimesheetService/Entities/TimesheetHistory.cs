using System;
using System.Collections.Generic;

namespace HR.TimesheetService.Entities;

public partial class TimesheetHistory
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string Action { get; set; } = null!;

    public string? ActorId { get; set; }

    public string? Comment { get; set; }

    public string TimesheetId { get; set; } = null!;

    public virtual Timesheet Timesheet { get; set; } = null!;
}
