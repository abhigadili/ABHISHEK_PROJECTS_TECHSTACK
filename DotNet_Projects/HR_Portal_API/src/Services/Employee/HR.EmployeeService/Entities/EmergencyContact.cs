using System;
using System.Collections.Generic;

namespace HR.EmployeeService.Entities;

public partial class EmergencyContact
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string? AlternatePhone { get; set; }

    public string? Email { get; set; }

    public string Name { get; set; } = null!;

    public string Phone { get; set; } = null!;

    public bool IsPrimary { get; set; }

    public string Relationship { get; set; } = null!;

    public string EmployeeId { get; set; } = null!;

    public virtual Employee Employee { get; set; } = null!;
}
