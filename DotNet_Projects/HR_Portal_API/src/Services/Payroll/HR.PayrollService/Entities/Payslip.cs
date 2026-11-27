using System;
using System.Collections.Generic;

namespace HR.PayrollService.Entities;

public partial class Payslip
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string EmployeeId { get; set; } = null!;

    public string EntryId { get; set; } = null!;

    public string FileName { get; set; } = null!;

    public DateTime GeneratedAt { get; set; }

    public string PayrollMonth { get; set; } = null!;

    public string RunId { get; set; } = null!;

    public string Sha256 { get; set; } = null!;

    public long SizeBytes { get; set; }

    public string StoragePath { get; set; } = null!;

    public virtual PayrollEntry Entry { get; set; } = null!;
}
