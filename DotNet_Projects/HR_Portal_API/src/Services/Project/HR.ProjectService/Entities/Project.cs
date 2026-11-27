using System;
using System.Collections.Generic;

namespace HR.ProjectService.Entities;

public partial class Project
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public bool Deleted { get; set; }

    public DateTime? DeletedAt { get; set; }

    public string? BillingContactId { get; set; }

    public string BillingModel { get; set; } = null!;

    public string? BillingNotes { get; set; }

    public decimal? BillingRate { get; set; }

    public decimal? Budget { get; set; }

    public string Code { get; set; } = null!;

    public string? Currency { get; set; }

    public string CustomerId { get; set; } = null!;

    public string? Description { get; set; }

    public DateOnly? EndDate { get; set; }

    public string Name { get; set; } = null!;

    public string ProjectManagerId { get; set; } = null!;

    public DateOnly StartDate { get; set; }

    public string Status { get; set; } = null!;

    public long Version { get; set; }

    public virtual Customer Customer { get; set; } = null!;

    public virtual ICollection<ProjectAllocation> ProjectAllocations { get; set; } = new List<ProjectAllocation>();

    public virtual ICollection<ProjectHistory> ProjectHistories { get; set; } = new List<ProjectHistory>();
}
