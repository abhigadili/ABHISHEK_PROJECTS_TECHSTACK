using System;
using System.Collections.Generic;

namespace HR.PayrollService.Entities;

public partial class PayrollEntry
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public decimal Deductions { get; set; }

    public string? DepartmentId { get; set; }

    public string? EmployeeCode { get; set; }

    public string EmployeeId { get; set; } = null!;

    public string? EmployeeName { get; set; }

    public decimal Gross { get; set; }

    public decimal LopDays { get; set; }

    public decimal Net { get; set; }

    public int OvertimeMinutes { get; set; }

    public decimal PaidDays { get; set; }

    public string PayrollMonth { get; set; } = null!;

    public string RunId { get; set; } = null!;

    public string SalaryId { get; set; } = null!;

    public decimal WorkingDays { get; set; }

    public virtual ICollection<PayrollEntryLine> PayrollEntryLines { get; set; } = new List<PayrollEntryLine>();

    public virtual Payslip? Payslip { get; set; }

    public virtual PayrollRun Run { get; set; } = null!;
}
