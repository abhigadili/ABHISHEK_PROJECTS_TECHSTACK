using System;
using System.Collections.Generic;

namespace HR.ProjectService.Entities;

public partial class ProjectHistory
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string ChangeType { get; set; } = null!;

    public string? NewValue { get; set; }

    public string? OldValue { get; set; }

    public string ProjectId { get; set; } = null!;

    public virtual Project Project { get; set; } = null!;
}
