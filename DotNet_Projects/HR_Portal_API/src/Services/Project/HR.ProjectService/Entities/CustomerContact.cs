using System;
using System.Collections.Generic;

namespace HR.ProjectService.Entities;

public partial class CustomerContact
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public bool Deleted { get; set; }

    public DateTime? DeletedAt { get; set; }

    public string CustomerId { get; set; } = null!;

    public string? Designation { get; set; }

    public string? Email { get; set; }

    public string Name { get; set; } = null!;

    public string? Phone { get; set; }

    public bool IsPrimary { get; set; }

    public virtual Customer Customer { get; set; } = null!;
}
