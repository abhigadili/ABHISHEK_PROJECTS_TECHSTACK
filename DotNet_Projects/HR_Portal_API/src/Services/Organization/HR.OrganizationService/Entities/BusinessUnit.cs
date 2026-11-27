using System;
using System.Collections.Generic;

namespace HR.OrganizationService.Entities;

public partial class BusinessUnit
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public bool Deleted { get; set; }

    public DateTime? DeletedAt { get; set; }

    public bool Active { get; set; }

    public string Code { get; set; } = null!;

    public string? HeadEmployeeId { get; set; }

    public string Name { get; set; } = null!;

    public string OrganizationId { get; set; } = null!;

    public virtual ICollection<Department> Departments { get; set; } = new List<Department>();

    public virtual Organization Organization { get; set; } = null!;
}
