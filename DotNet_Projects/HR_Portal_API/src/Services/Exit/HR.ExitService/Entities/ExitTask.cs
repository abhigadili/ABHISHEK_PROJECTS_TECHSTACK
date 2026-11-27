using System;
using System.Collections.Generic;

namespace HR.ExitService.Entities;

public partial class ExitTask
{
    public string TaskType { get; set; } = null!;

    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public DateTime? CompletedAt { get; set; }

    public string? CompletedBy { get; set; }

    public DateOnly? DueDate { get; set; }

    public string? Remarks { get; set; }

    public string ResignationId { get; set; } = null!;

    public string Status { get; set; } = null!;

    public string Title { get; set; } = null!;

    public DateOnly? RevokedOn { get; set; }

    public string? SystemName { get; set; }

    public string? AssetCondition { get; set; }

    public string? AssetTag { get; set; }

    public DateOnly? ReturnedOn { get; set; }

    public string? Department { get; set; }

    public string? KtTopic { get; set; }

    public string? KtTransfereeId { get; set; }

    public virtual Resignation Resignation { get; set; } = null!;
}
