using System;
using System.Collections.Generic;

namespace HR.ProjectService.Entities;

public partial class VwProjectEmployeeAllocation
{
    public string AllocationId { get; set; } = null!;

    public string ProjectId { get; set; } = null!;

    public string ProjectCode { get; set; } = null!;

    public string ProjectName { get; set; } = null!;

    public string ProjectStatus { get; set; } = null!;

    public string CustomerName { get; set; } = null!;

    public string EmployeeId { get; set; } = null!;

    public string? EmployeeName { get; set; }

    public string Role { get; set; } = null!;

    public decimal AllocationPercent { get; set; }

    public bool Billable { get; set; }

    public DateOnly StartDate { get; set; }

    public DateOnly? EndDate { get; set; }

    public string AllocationStatus { get; set; } = null!;
}
