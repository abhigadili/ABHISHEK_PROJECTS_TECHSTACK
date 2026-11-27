using System;
using System.Collections.Generic;

namespace HR.EmployeeService.Entities;

public partial class VwEmployeeDirectory
{
    public string EmployeeId { get; set; } = null!;

    public string EmployeeCode { get; set; } = null!;

    public string? FullName { get; set; }

    public string WorkEmail { get; set; } = null!;

    public string DepartmentId { get; set; } = null!;

    public string DesignationId { get; set; } = null!;

    public string LocationId { get; set; } = null!;

    public string? ManagerId { get; set; }

    public string Status { get; set; } = null!;

    public string EmploymentType { get; set; } = null!;

    public DateOnly JoiningDate { get; set; }

    public int? TenureMonths { get; set; }
}
