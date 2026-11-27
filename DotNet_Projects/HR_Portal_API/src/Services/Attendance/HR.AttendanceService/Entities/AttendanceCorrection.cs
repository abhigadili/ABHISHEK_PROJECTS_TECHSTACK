using System;
using System.Collections.Generic;

namespace HR.AttendanceService.Entities;

public partial class AttendanceCorrection
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string EmployeeId { get; set; } = null!;

    public string? EmployeeName { get; set; }

    public bool Escalated { get; set; }

    public string? ManagerId { get; set; }

    public string Reason { get; set; } = null!;

    public DateTime RequestedCheckIn { get; set; }

    public DateTime RequestedCheckOut { get; set; }

    public string? ReviewComment { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public string? ReviewerId { get; set; }

    public string Status { get; set; } = null!;

    public DateOnly WorkDate { get; set; }
}
