using System;
using System.Collections.Generic;

namespace HR.PayrollService.Entities;

public partial class SalaryComponent
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public bool Deleted { get; set; }

    public DateTime? DeletedAt { get; set; }

    public bool Active { get; set; }

    public string CalcType { get; set; } = null!;

    public string Code { get; set; } = null!;

    public int DisplayOrder { get; set; }

    public string Name { get; set; } = null!;

    public bool Taxable { get; set; }

    public string Type { get; set; } = null!;

    public virtual ICollection<SalaryStructureComponent> SalaryStructureComponents { get; set; } = new List<SalaryStructureComponent>();
}
