using System;
using System.Collections.Generic;

namespace HR.EmployeeService.Entities;

public partial class ProfileChangeLog
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string EmployeeId { get; set; } = null!;

    public string FieldName { get; set; } = null!;

    public string? NewValue { get; set; }

    public string? OldValue { get; set; }
}
