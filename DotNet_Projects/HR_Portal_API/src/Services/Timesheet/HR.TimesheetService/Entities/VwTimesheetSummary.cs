using System;
using System.Collections.Generic;

namespace HR.TimesheetService.Entities;

public partial class VwTimesheetSummary
{
    public string TimesheetId { get; set; } = null!;

    public string EmployeeId { get; set; } = null!;

    public DateOnly WeekStart { get; set; }

    public DateOnly? WeekEnd { get; set; }

    public string Status { get; set; } = null!;

    public decimal TotalHours { get; set; }

    public decimal BillableHours { get; set; }

    public decimal NonBillableHours { get; set; }

    public long ProjectCount { get; set; }

    public DateTime? SubmittedAt { get; set; }

    public DateTime? DecidedAt { get; set; }

    public int ResubmissionCount { get; set; }
}
