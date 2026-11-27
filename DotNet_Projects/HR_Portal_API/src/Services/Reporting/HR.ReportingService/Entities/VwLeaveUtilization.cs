using System;
using System.Collections.Generic;

namespace HR.ReportingService.Entities;

public partial class VwLeaveUtilization
{
    public string? Month { get; set; }

    public string? LeaveType { get; set; }

    public string? Status { get; set; }

    public long Applications { get; set; }

    public decimal? Days { get; set; }
}
