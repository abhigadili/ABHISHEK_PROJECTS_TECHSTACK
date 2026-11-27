using System;
using System.Collections.Generic;

namespace HR.OrganizationService.Entities;

public partial class OrgEmployeeNode
{
    public string EmployeeId { get; set; } = null!;

    public string? DepartmentId { get; set; }

    public string? DesignationId { get; set; }

    public string? Email { get; set; }

    public string? EmployeeCode { get; set; }

    public string FullName { get; set; } = null!;

    public DateOnly? JoiningDate { get; set; }

    public string? LocationId { get; set; }

    public string? ManagerId { get; set; }

    public string Status { get; set; } = null!;

    public DateTime UpdatedAt { get; set; }
}
