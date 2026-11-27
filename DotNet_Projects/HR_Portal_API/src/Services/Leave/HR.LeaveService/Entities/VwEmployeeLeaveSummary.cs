using System;
using System.Collections.Generic;

namespace HR.LeaveService.Entities;

public partial class VwEmployeeLeaveSummary
{
    public string EmployeeId { get; set; } = null!;

    public int BalanceYear { get; set; }

    public string LeaveTypeCode { get; set; } = null!;

    public string LeaveTypeName { get; set; } = null!;

    public decimal Entitled { get; set; }

    public decimal Used { get; set; }

    public decimal Pending { get; set; }

    public decimal Encashed { get; set; }

    public decimal Available { get; set; }
}
