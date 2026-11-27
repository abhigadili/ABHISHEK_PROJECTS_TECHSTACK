using System;
using System.Collections.Generic;

namespace HR.AttendanceService.Entities;

public partial class VwMonthlyAttendanceSummary
{
    public string EmployeeId { get; set; } = null!;

    public int SummaryYear { get; set; }

    public int SummaryMonth { get; set; }

    public int WorkingDays { get; set; }

    public int PresentDays { get; set; }

    public int HalfDays { get; set; }

    public int AbsentDays { get; set; }

    public int LeaveDays { get; set; }

    public int Holidays { get; set; }

    public int WeeklyOffs { get; set; }

    public int WfhDays { get; set; }

    public int MissingPunches { get; set; }

    public int LateCount { get; set; }

    public int OvertimeMinutes { get; set; }

    public int? WeekdaysInMonth { get; set; }

    public decimal? AttendancePercent { get; set; }

    public DateTime GeneratedAt { get; set; }
}
