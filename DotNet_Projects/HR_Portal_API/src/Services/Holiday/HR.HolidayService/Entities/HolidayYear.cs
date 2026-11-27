using System;
using System.Collections.Generic;

namespace HR.HolidayService.Entities;

public partial class HolidayYear
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public bool Active { get; set; }

    public string? Description { get; set; }

    public DateOnly EndDate { get; set; }

    public DateOnly StartDate { get; set; }

    public int YearNumber { get; set; }
}
