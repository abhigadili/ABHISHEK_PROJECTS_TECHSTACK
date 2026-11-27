using System;
using System.Collections.Generic;

namespace HR.TimesheetService.Entities;

public partial class TimesheetTask
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public bool Deleted { get; set; }

    public DateTime? DeletedAt { get; set; }

    public bool Active { get; set; }

    public bool Billable { get; set; }

    public string Code { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string ProjectId { get; set; } = null!;
}
