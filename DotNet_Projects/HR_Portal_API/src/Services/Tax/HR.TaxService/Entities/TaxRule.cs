using System;
using System.Collections.Generic;

namespace HR.TaxService.Entities;

public partial class TaxRule
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public bool Active { get; set; }

    public decimal CessPercent { get; set; }

    public string FinancialYear { get; set; } = null!;

    public decimal RebateAmount { get; set; }

    public decimal RebateLimit { get; set; }

    public string Regime { get; set; } = null!;

    public string SectionLimits { get; set; } = null!;

    public string Slabs { get; set; } = null!;

    public decimal StandardDeduction { get; set; }
}
