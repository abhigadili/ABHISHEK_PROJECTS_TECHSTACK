using System;
using System.Collections.Generic;

namespace HR.AttendanceService.Entities;

public partial class HolidaySnapshot
{
    public string HolidayId { get; set; } = null!;

    public DateOnly HolidayDate { get; set; }

    public string? LocationId { get; set; }

    public string? Name { get; set; }
}
