using System;
using System.Collections.Generic;

namespace HR.LeaveService.Entities;

public partial class LeaveApplication
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public DateTime AppliedAt { get; set; }

    public string? CancelReason { get; set; }

    public bool CancelRequested { get; set; }

    public decimal Days { get; set; }

    public DateTime? DecidedAt { get; set; }

    public string EmployeeId { get; set; } = null!;

    public string? EmployeeName { get; set; }

    public DateOnly FromDate { get; set; }

    public bool HalfDayEnd { get; set; }

    public bool HalfDayStart { get; set; }

    public string LeaveTypeId { get; set; } = null!;

    public string? ManagerId { get; set; }

    public string? Reason { get; set; }

    public string Stage { get; set; } = null!;

    public string Status { get; set; } = null!;

    public DateOnly ToDate { get; set; }

    public long Version { get; set; }
}
