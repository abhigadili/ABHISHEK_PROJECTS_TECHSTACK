using System;
using System.Collections.Generic;

namespace HR.ReportingService.Entities;

public partial class RptFact
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string? Category { get; set; }

    public DateOnly? DateA { get; set; }

    public DateOnly? DateB { get; set; }

    public string? DepartmentId { get; set; }

    public string? EmployeeId { get; set; }

    public string FactType { get; set; } = null!;

    public decimal? NumA { get; set; }

    public decimal? NumB { get; set; }

    public decimal? NumC { get; set; }

    public DateTime OccurredAt { get; set; }

    public string? PeriodKey { get; set; }

    public string? Status { get; set; }

    public string SubjectKey { get; set; } = null!;
}
