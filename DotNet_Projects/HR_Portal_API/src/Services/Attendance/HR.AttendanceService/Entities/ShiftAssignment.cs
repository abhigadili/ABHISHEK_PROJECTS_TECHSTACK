using System;
using System.Collections.Generic;

namespace HR.AttendanceService.Entities;

public partial class ShiftAssignment
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public DateOnly EffectiveFrom { get; set; }

    public DateOnly? EffectiveTo { get; set; }

    public string EmployeeId { get; set; } = null!;

    public string ShiftId { get; set; } = null!;
}
