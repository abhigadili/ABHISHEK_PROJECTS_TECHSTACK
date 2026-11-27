using System;
using System.Collections.Generic;

namespace HR.ExitService.Entities;

public partial class ExitInterview
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string? Answers { get; set; }

    public DateTime? CompletedAt { get; set; }

    public string? ConductedBy { get; set; }

    public string? FeedbackSummary { get; set; }

    public string FormId { get; set; } = null!;

    public string ResignationId { get; set; } = null!;

    public DateTime? ScheduledAt { get; set; }

    public string Status { get; set; } = null!;

    public bool? WouldRecommend { get; set; }

    public virtual Resignation Resignation { get; set; } = null!;
}
