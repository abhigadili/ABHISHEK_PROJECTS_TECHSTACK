using System;
using System.Collections.Generic;

namespace HR.TaxService.Entities;

public partial class TaxDeclaration
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string EmployeeId { get; set; } = null!;

    public string? EmployeeName { get; set; }

    public string FinancialYear { get; set; } = null!;

    public string Regime { get; set; } = null!;

    public string? ReviewComment { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public string? ReviewerId { get; set; }

    public string Status { get; set; } = null!;

    public DateTime? SubmittedAt { get; set; }

    public decimal TotalApproved { get; set; }

    public decimal TotalDeclared { get; set; }

    public long Version { get; set; }

    public virtual ICollection<InvestmentDeclaration> InvestmentDeclarations { get; set; } = new List<InvestmentDeclaration>();

    public virtual ICollection<TaxDeclarationHistory> TaxDeclarationHistories { get; set; } = new List<TaxDeclarationHistory>();

    public virtual ICollection<TaxProof> TaxProofs { get; set; } = new List<TaxProof>();
}
