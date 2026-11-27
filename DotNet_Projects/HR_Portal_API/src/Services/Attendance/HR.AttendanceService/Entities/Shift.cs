using System;
using System.Collections.Generic;

namespace HR.AttendanceService.Entities;

public partial class Shift
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public bool Deleted { get; set; }

    public DateTime? DeletedAt { get; set; }

    public bool Active { get; set; }

    public string Code { get; set; } = null!;

    public bool IsDefault { get; set; }

    public TimeOnly EndTime { get; set; }

    public int FullDayMinutes { get; set; }

    public int GraceMinutes { get; set; }

    public int HalfDayMinutes { get; set; }

    public string Name { get; set; } = null!;

    public int OvertimeThresholdMinutes { get; set; }

    public int StandardMinutes { get; set; }

    public TimeOnly StartTime { get; set; }

    public string WeeklyOffs { get; set; } = null!;
}
