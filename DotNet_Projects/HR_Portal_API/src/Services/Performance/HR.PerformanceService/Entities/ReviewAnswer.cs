using System;
using System.Collections.Generic;

namespace HR.PerformanceService.Entities;

public partial class ReviewAnswer
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string? AnswerText { get; set; }

    public string QuestionId { get; set; } = null!;

    public decimal? Rating { get; set; }

    public string Respondent { get; set; } = null!;

    public string ReviewId { get; set; } = null!;

    public virtual PerformanceReview Review { get; set; } = null!;
}
