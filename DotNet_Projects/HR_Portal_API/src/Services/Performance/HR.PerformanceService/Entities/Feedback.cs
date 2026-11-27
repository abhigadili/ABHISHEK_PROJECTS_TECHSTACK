using System;
using System.Collections.Generic;

namespace HR.PerformanceService.Entities;

public partial class Feedback
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string Comment { get; set; } = null!;

    public string FromEmployeeId { get; set; } = null!;

    public decimal? Rating { get; set; }

    public string? ReviewId { get; set; }

    public string ToEmployeeId { get; set; } = null!;

    public string Type { get; set; } = null!;
}
