using System;
using System.Collections.Generic;

namespace HR.PerformanceService.Entities;

public partial class PerformanceReview
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string? Achievements { get; set; }

    public DateTime? ApprovedAt { get; set; }

    public string CycleId { get; set; } = null!;

    public string EmployeeId { get; set; } = null!;

    public string? EmployeeName { get; set; }

    public decimal? FinalRating { get; set; }

    public string FormId { get; set; } = null!;

    public string? HrComment { get; set; }

    public string? ImprovementAreas { get; set; }

    public string? ManagerFeedback { get; set; }

    public string? ManagerId { get; set; }

    public decimal? ManagerRating { get; set; }

    public DateTime? ManagerSubmittedAt { get; set; }

    public decimal? SelfRating { get; set; }

    public DateTime? SelfSubmittedAt { get; set; }

    public string Status { get; set; } = null!;

    public string? Strengths { get; set; }

    public long Version { get; set; }

    public virtual ReviewCycle Cycle { get; set; } = null!;

    public virtual ICollection<ReviewAnswer> ReviewAnswers { get; set; } = new List<ReviewAnswer>();

    public virtual ICollection<ReviewHistory> ReviewHistories { get; set; } = new List<ReviewHistory>();
}
