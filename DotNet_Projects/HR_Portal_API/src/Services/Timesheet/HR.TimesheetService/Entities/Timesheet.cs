using System;
using System.Collections.Generic;

namespace HR.TimesheetService.Entities;

public partial class Timesheet
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string? ApproverId { get; set; }

    public decimal BillableHours { get; set; }

    public DateTime? DecidedAt { get; set; }

    public string? DecisionComment { get; set; }

    public string EmployeeId { get; set; } = null!;

    public string? EmployeeName { get; set; }

    public int ResubmissionCount { get; set; }

    public string Status { get; set; } = null!;

    public DateTime? SubmittedAt { get; set; }

    public decimal TotalHours { get; set; }

    public long Version { get; set; }

    public DateOnly WeekStart { get; set; }

    public virtual ICollection<TimesheetEntry> TimesheetEntries { get; set; } = new List<TimesheetEntry>();

    public virtual ICollection<TimesheetHistory> TimesheetHistories { get; set; } = new List<TimesheetHistory>();
}
