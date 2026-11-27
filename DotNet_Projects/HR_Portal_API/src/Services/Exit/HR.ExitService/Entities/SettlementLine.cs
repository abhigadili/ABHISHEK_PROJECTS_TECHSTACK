using System;
using System.Collections.Generic;

namespace HR.ExitService.Entities;

public partial class SettlementLine
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public decimal Amount { get; set; }

    public string Code { get; set; } = null!;

    public string Description { get; set; } = null!;

    public string SettlementId { get; set; } = null!;

    public string Type { get; set; } = null!;

    public virtual Settlement Settlement { get; set; } = null!;
}
