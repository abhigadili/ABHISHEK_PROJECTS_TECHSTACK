using System;
using System.Collections.Generic;

namespace HR.TaxService.Entities;

public partial class InvestmentDeclaration
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public decimal ApprovedAmount { get; set; }

    public string DeclarationId { get; set; } = null!;

    public decimal DeclaredAmount { get; set; }

    public string Description { get; set; } = null!;

    public string Section { get; set; } = null!;

    public string Status { get; set; } = null!;

    public virtual TaxDeclaration Declaration { get; set; } = null!;

    public virtual ICollection<TaxProof> TaxProofs { get; set; } = new List<TaxProof>();
}
