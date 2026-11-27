using System;
using System.Collections.Generic;

namespace HR.TaxService.Entities;

public partial class TaxComputation
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public decimal Cess { get; set; }

    public DateTime ComputedAt { get; set; }

    public bool DeclarationApproved { get; set; }

    public string EmployeeId { get; set; } = null!;

    public string FinancialYear { get; set; } = null!;

    public decimal GrossIncome { get; set; }

    public decimal Rebate { get; set; }

    public string Regime { get; set; } = null!;

    public decimal SlabTax { get; set; }

    public decimal StandardDeduction { get; set; }

    public decimal TaxableIncome { get; set; }

    public decimal TotalDeductions { get; set; }

    public decimal TotalTax { get; set; }
}
