using System;
using System.Collections.Generic;

namespace HR.ProjectService.Entities;

public partial class ProjectAllocation
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public decimal AllocationPercent { get; set; }

    public bool Billable { get; set; }

    public string EmployeeId { get; set; } = null!;

    public string? EmployeeName { get; set; }

    public DateOnly? EndDate { get; set; }

    public string ProjectId { get; set; } = null!;

    public string Role { get; set; } = null!;

    public DateOnly StartDate { get; set; }

    public string Status { get; set; } = null!;

    public virtual Project Project { get; set; } = null!;
}
