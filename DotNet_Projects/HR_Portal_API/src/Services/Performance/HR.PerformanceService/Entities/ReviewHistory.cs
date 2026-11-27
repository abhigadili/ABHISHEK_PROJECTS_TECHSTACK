using System;
using System.Collections.Generic;

namespace HR.PerformanceService.Entities;

public partial class ReviewHistory
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string Action { get; set; } = null!;

    public string? Comment { get; set; }

    public string ReviewId { get; set; } = null!;

    public string? Status { get; set; }

    public virtual PerformanceReview Review { get; set; } = null!;
}
