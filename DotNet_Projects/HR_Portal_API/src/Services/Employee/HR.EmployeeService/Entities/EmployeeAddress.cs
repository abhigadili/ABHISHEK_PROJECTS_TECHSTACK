using System;
using System.Collections.Generic;

namespace HR.EmployeeService.Entities;

public partial class EmployeeAddress
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string City { get; set; } = null!;

    public string Country { get; set; } = null!;

    public string Line1 { get; set; } = null!;

    public string? Line2 { get; set; }

    public string? PostalCode { get; set; }

    public bool IsPrimary { get; set; }

    public string? State { get; set; }

    public string Type { get; set; } = null!;

    public string EmployeeId { get; set; } = null!;

    public virtual Employee Employee { get; set; } = null!;
}
