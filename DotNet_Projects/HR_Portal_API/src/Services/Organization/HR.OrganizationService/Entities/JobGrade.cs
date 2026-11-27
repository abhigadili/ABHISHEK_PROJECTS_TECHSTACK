using System;
using System.Collections.Generic;

namespace HR.OrganizationService.Entities;

public partial class JobGrade
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public bool Deleted { get; set; }

    public DateTime? DeletedAt { get; set; }

    public string Code { get; set; } = null!;

    public string? Currency { get; set; }

    public int GradeLevel { get; set; }

    public decimal? MaxSalary { get; set; }

    public decimal? MinSalary { get; set; }

    public string Name { get; set; } = null!;

    public virtual ICollection<Designation> Designations { get; set; } = new List<Designation>();
}
