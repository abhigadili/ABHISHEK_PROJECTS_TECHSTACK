using System;
using System.Collections.Generic;

namespace HR.PayrollService.Entities;

public partial class LoanDeduction
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public decimal Amount { get; set; }

    public string EmployeeId { get; set; } = null!;

    public string LoanId { get; set; } = null!;

    public string RunId { get; set; } = null!;

    public virtual Loan Loan { get; set; } = null!;

    public virtual PayrollRun Run { get; set; } = null!;
}
