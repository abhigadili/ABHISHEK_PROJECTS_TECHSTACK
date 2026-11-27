using System;
using System.Collections.Generic;

namespace HR.PayrollService.Entities;

public partial class PayrollRun
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public DateTime? ApprovedAt { get; set; }

    public string? ApprovedBy { get; set; }

    public int EmployeeCount { get; set; }

    public DateTime? FinalizedAt { get; set; }

    public string? FinalizedBy { get; set; }

    public string? Note { get; set; }

    public string PayrollMonth { get; set; } = null!;

    public DateTime? ProcessedAt { get; set; }

    public string? ProcessedBy { get; set; }

    public string Status { get; set; } = null!;

    public decimal TotalDeductions { get; set; }

    public decimal TotalGross { get; set; }

    public decimal TotalNet { get; set; }

    public long Version { get; set; }

    public virtual ICollection<LoanDeduction> LoanDeductions { get; set; } = new List<LoanDeduction>();

    public virtual ICollection<PayrollEntry> PayrollEntries { get; set; } = new List<PayrollEntry>();
}
