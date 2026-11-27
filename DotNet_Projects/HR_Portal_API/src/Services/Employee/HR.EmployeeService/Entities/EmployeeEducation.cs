using System;
using System.Collections.Generic;

namespace HR.EmployeeService.Entities;

public partial class EmployeeEducation
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string Degree { get; set; } = null!;

    public string? EmployeeId { get; set; }

    public int? EndYear { get; set; }

    public string? FieldOfStudy { get; set; }

    public string? Grade { get; set; }

    public string Institution { get; set; } = null!;

    public int? StartYear { get; set; }

    public virtual Employee? Employee { get; set; }
}
