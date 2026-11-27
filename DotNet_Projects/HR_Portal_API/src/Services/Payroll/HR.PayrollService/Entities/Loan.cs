using System;
using System.Collections.Generic;

namespace HR.PayrollService.Entities;

public partial class Loan
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string Description { get; set; } = null!;

    public decimal Emi { get; set; }

    public string EmployeeId { get; set; } = null!;

    public decimal Outstanding { get; set; }

    public decimal Principal { get; set; }

    public string StartMonth { get; set; } = null!;

    public string Status { get; set; } = null!;

    public long Version { get; set; }

    public virtual ICollection<LoanDeduction> LoanDeductions { get; set; } = new List<LoanDeduction>();
}
