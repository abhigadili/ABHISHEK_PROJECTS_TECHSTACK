using System;
using System.Collections.Generic;

namespace HR.TaxService.Entities;

public partial class MonthlyTd
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public DateTime ComputedAt { get; set; }

    public bool DeclarationApproved { get; set; }

    public string EmployeeId { get; set; } = null!;

    public string FinancialYear { get; set; } = null!;

    public string Regime { get; set; } = null!;

    public decimal Tds { get; set; }

    public string TdsMonth { get; set; } = null!;
}
