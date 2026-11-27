using System;
using System.Collections.Generic;

namespace HR.PayrollService.Entities;

public partial class EmployeeSalary
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public decimal AnnualCtc { get; set; }

    public string Currency { get; set; } = null!;

    public DateOnly EffectiveFrom { get; set; }

    public DateOnly? EffectiveTo { get; set; }

    public string EmployeeId { get; set; } = null!;

    public string Status { get; set; } = null!;

    public string StructureId { get; set; } = null!;

    public long Version { get; set; }

    public virtual SalaryStructure Structure { get; set; } = null!;
}
