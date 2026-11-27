using System;
using System.Collections.Generic;

namespace HR.AttendanceService.Entities;

public partial class ApprovedLeaveDay
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string ApplicationId { get; set; } = null!;

    public string EmployeeId { get; set; } = null!;

    public DateOnly LeaveDate { get; set; }
}
