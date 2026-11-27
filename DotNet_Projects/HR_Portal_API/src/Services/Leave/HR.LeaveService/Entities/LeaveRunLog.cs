using System;
using System.Collections.Generic;

namespace HR.LeaveService.Entities;

public partial class LeaveRunLog
{
    public string RunKey { get; set; } = null!;

    public DateTime ExecutedAt { get; set; }

    public string? ExecutedBy { get; set; }

    public int RecordsProcessed { get; set; }
}
