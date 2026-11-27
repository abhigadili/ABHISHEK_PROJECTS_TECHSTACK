using System;
using System.Collections.Generic;

namespace HR.TaxService.Entities;

public partial class TaxProof
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public int AttemptNumber { get; set; }

    public string DeclarationId { get; set; } = null!;

    public string DocumentId { get; set; } = null!;

    public string? FileName { get; set; }

    public string InvestmentId { get; set; } = null!;

    public DateTime? ReviewedAt { get; set; }

    public string? ReviewerComment { get; set; }

    public string? ReviewerId { get; set; }

    public string Status { get; set; } = null!;

    public virtual TaxDeclaration Declaration { get; set; } = null!;

    public virtual InvestmentDeclaration Investment { get; set; } = null!;
}
