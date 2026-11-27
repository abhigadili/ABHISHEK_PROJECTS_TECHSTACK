using System;
using System.Collections.Generic;

namespace HR.LeaveService.Entities;

public partial class LeaveBalance
{
    public string EmployeeId { get; set; } = null!;

    public string LeaveTypeId { get; set; } = null!;

    public int BalanceYear { get; set; }

    public decimal Accrued { get; set; }

    public decimal Adjusted { get; set; }

    public decimal CarriedForward { get; set; }

    public DateTime? CreatedAt { get; set; }

    public decimal Encashed { get; set; }

    public decimal Opening { get; set; }

    public decimal Pending { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public decimal Used { get; set; }

    public long Version { get; set; }
}
