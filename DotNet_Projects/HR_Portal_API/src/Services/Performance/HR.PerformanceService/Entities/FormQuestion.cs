using System;
using System.Collections.Generic;

namespace HR.PerformanceService.Entities;

public partial class FormQuestion
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string FormId { get; set; } = null!;

    public int OrderNo { get; set; }

    public bool Required { get; set; }

    public string Section { get; set; } = null!;

    public string Text { get; set; } = null!;

    public string Type { get; set; } = null!;

    public decimal Weight { get; set; }

    public virtual EvaluationForm Form { get; set; } = null!;
}
