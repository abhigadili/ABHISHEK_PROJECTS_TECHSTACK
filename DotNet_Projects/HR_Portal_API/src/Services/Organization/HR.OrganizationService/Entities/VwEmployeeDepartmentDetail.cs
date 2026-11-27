using System;
using System.Collections.Generic;

namespace HR.OrganizationService.Entities;

public partial class VwEmployeeDepartmentDetail
{
    public string EmployeeId { get; set; } = null!;

    public string? EmployeeCode { get; set; }

    public string FullName { get; set; } = null!;

    public string Status { get; set; } = null!;

    public DateOnly? JoiningDate { get; set; }

    public string? DepartmentName { get; set; }

    public string? DepartmentCode { get; set; }

    public string? DesignationTitle { get; set; }

    public string? JobGradeName { get; set; }

    public string? LocationName { get; set; }

    public string? ManagerId { get; set; }
}
