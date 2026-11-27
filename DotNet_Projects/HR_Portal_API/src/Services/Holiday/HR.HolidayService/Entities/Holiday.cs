using System;
using System.Collections.Generic;

namespace HR.HolidayService.Entities;

public partial class Holiday
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public bool Deleted { get; set; }

    public DateTime? DeletedAt { get; set; }

    public string? Description { get; set; }

    public DateOnly HolidayDate { get; set; }

    public int HolidayYear { get; set; }

    public string Name { get; set; } = null!;

    public string Type { get; set; } = null!;
}
