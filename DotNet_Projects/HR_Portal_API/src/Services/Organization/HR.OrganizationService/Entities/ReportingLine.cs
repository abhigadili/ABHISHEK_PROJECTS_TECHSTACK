using System;
using System.Collections.Generic;

namespace HR.OrganizationService.Entities;

public partial class ReportingLine
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public DateTime EffectiveFrom { get; set; }

    public DateTime? EffectiveTo { get; set; }

    public string EmployeeId { get; set; } = null!;

    public string? ManagerId { get; set; }
}
