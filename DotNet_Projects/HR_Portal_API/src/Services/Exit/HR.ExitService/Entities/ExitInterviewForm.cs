using System;
using System.Collections.Generic;

namespace HR.ExitService.Entities;

public partial class ExitInterviewForm
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public bool Active { get; set; }

    public string Name { get; set; } = null!;

    public string Questions { get; set; } = null!;
}
