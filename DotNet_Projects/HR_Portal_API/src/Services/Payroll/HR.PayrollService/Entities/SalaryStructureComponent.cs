using System;
using System.Collections.Generic;

namespace HR.PayrollService.Entities;

public partial class SalaryStructureComponent
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string ComponentId { get; set; } = null!;

    public string StructureId { get; set; } = null!;

    public decimal Value { get; set; }

    public virtual SalaryComponent Component { get; set; } = null!;

    public virtual SalaryStructure Structure { get; set; } = null!;
}
