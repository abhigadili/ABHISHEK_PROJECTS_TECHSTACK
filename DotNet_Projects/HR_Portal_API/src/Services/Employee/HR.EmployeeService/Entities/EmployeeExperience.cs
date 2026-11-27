using System;
using System.Collections.Generic;

namespace HR.EmployeeService.Entities;

public partial class EmployeeExperience
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string Company { get; set; } = null!;

    public string? Description { get; set; }

    public string EmployeeId { get; set; } = null!;

    public DateOnly? EndDate { get; set; }

    public string JobTitle { get; set; } = null!;

    public DateOnly StartDate { get; set; }

    public bool Verified { get; set; }
}
