using System;
using System.Collections.Generic;

namespace HR.OrganizationService.Entities;

public partial class Designation
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

    public string? Description { get; set; }

    public string? JobGradeId { get; set; }

    public string Title { get; set; } = null!;

    public virtual JobGrade? JobGrade { get; set; }
}
