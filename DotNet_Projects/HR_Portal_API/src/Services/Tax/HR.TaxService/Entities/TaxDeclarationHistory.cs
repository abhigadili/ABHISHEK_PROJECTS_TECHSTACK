using System;
using System.Collections.Generic;

namespace HR.TaxService.Entities;

public partial class TaxDeclarationHistory
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string Action { get; set; } = null!;

    public string? Comment { get; set; }

    public string DeclarationId { get; set; } = null!;

    public string? Status { get; set; }

    public decimal? TotalDeclared { get; set; }

    public virtual TaxDeclaration Declaration { get; set; } = null!;
}
