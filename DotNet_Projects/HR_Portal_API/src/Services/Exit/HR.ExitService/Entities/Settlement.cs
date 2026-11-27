using System;
using System.Collections.Generic;

namespace HR.ExitService.Entities;

public partial class Settlement
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string? CalculatedBy { get; set; }

    public string EmployeeId { get; set; } = null!;

    public decimal GrossPayable { get; set; }

    public decimal NetPayable { get; set; }

    public DateTime? PaidAt { get; set; }

    public string? PaymentReference { get; set; }

    public string? ProcessedBy { get; set; }

    public decimal Recoveries { get; set; }

    public string ResignationId { get; set; } = null!;

    public string Status { get; set; } = null!;

    public virtual Resignation Resignation { get; set; } = null!;

    public virtual ICollection<SettlementLine> SettlementLines { get; set; } = new List<SettlementLine>();
}
