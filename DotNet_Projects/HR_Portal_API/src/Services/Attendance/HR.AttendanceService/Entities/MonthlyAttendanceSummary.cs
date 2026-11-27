using System;
using System.Collections.Generic;

namespace HR.AttendanceService.Entities;

public partial class MonthlyAttendanceSummary
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public int AbsentDays { get; set; }

    public int EarlyCount { get; set; }

    public string EmployeeId { get; set; } = null!;

    public DateTime GeneratedAt { get; set; }

    public int HalfDays { get; set; }

    public int Holidays { get; set; }

    public int LateCount { get; set; }

    public int LateMinutes { get; set; }

    public int LeaveDays { get; set; }

    public int MissingPunches { get; set; }

    public int OvertimeMinutes { get; set; }

    public int PresentDays { get; set; }

    public int SummaryMonth { get; set; }

    public int SummaryYear { get; set; }

    public int TotalDays { get; set; }

    public int WeeklyOffs { get; set; }

    public int WfhDays { get; set; }

    public int WorkedMinutes { get; set; }

    public int WorkingDays { get; set; }
}
