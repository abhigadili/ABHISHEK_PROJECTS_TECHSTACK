using System;
using System.Collections.Generic;

namespace HR.TaxService.Entities;

public partial class TaxEmployee
{
    public string EmployeeId { get; set; } = null!;

    public string? FullName { get; set; }

    public string Status { get; set; } = null!;

    public DateTime UpdatedAt { get; set; }
}
