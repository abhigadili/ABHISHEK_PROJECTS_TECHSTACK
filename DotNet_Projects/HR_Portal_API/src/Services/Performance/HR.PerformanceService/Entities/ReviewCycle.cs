using System;
using System.Collections.Generic;

namespace HR.PerformanceService.Entities;

public partial class ReviewCycle
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string FormId { get; set; } = null!;

    public DateOnly ManagerEvalDeadline { get; set; }

    public string Name { get; set; } = null!;

    public DateOnly PeriodEnd { get; set; }

    public DateOnly PeriodStart { get; set; }

    public DateOnly SelfEvalDeadline { get; set; }

    public string Status { get; set; } = null!;

    public string Type { get; set; } = null!;

    public virtual ICollection<PerformanceReview> PerformanceReviews { get; set; } = new List<PerformanceReview>();
}
