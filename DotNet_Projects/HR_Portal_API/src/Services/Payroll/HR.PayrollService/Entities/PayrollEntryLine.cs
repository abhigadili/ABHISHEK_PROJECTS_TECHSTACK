using System;
using System.Collections.Generic;

namespace HR.PayrollService.Entities;

public partial class PayrollEntryLine
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public decimal Amount { get; set; }

    public string ComponentCode { get; set; } = null!;

    public string ComponentName { get; set; } = null!;

    public string EntryId { get; set; } = null!;

    public string? Note { get; set; }

    public string Type { get; set; } = null!;

    public virtual PayrollEntry Entry { get; set; } = null!;
}
