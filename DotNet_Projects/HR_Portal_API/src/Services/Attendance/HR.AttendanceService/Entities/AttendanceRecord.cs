using System;
using System.Collections.Generic;

namespace HR.AttendanceService.Entities;

public partial class AttendanceRecord
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public DateTime? CheckIn { get; set; }

    public DateTime? CheckOut { get; set; }

    public int EarlyDepartureMinutes { get; set; }

    public string EmployeeId { get; set; } = null!;

    public int LateMinutes { get; set; }

    public int OvertimeMinutes { get; set; }

    public string? Remarks { get; set; }

    public string? ShiftId { get; set; }

    public string Source { get; set; } = null!;

    public string Status { get; set; } = null!;

    public long Version { get; set; }

    public DateOnly WorkDate { get; set; }

    public string WorkMode { get; set; } = null!;

    public int WorkedMinutes { get; set; }
}
