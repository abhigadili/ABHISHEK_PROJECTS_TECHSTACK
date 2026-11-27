using System;
using System.Collections.Generic;

namespace HR.ReportingService.Entities;

public partial class VwHeadcountByDepartment
{
    public string? DepartmentId { get; set; }

    public string Status { get; set; } = null!;

    public long Employees { get; set; }
}
