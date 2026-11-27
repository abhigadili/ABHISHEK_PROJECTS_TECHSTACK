using System;
using System.Collections.Generic;

namespace HR.LeaveService.Entities;

public partial class LeaveBalanceHistory
{
    public long Id { get; set; }

    public int BalanceYear { get; set; }

    public DateTime ChangedAt { get; set; }

    public string? ChangedBy { get; set; }

    public string EmployeeId { get; set; } = null!;

    public string LeaveTypeId { get; set; } = null!;

    public decimal? NewAccrued { get; set; }

    public decimal? NewCarried { get; set; }

    public decimal? NewEncashed { get; set; }

    public decimal? NewPending { get; set; }

    public decimal? NewUsed { get; set; }

    public decimal? OldAccrued { get; set; }

    public decimal? OldCarried { get; set; }

    public decimal? OldEncashed { get; set; }

    public decimal? OldPending { get; set; }

    public decimal? OldUsed { get; set; }
}
