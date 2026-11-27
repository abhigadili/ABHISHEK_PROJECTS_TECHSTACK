using System;
using System.Collections.Generic;

namespace HR.PayrollService.Entities;

public partial class VwEmployeeSalarySummary
{
    public string EmployeeId { get; set; } = null!;

    public string StructureName { get; set; } = null!;

    public decimal AnnualCtc { get; set; }

    public decimal? MonthlyCtc { get; set; }

    public decimal? MonthlyBasic { get; set; }

    public string Currency { get; set; } = null!;

    public DateOnly EffectiveFrom { get; set; }
}
