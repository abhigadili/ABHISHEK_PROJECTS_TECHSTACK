using System;
using System.Collections.Generic;

namespace HR.LeaveService.Entities;

public partial class LeavePolicyEntitlement
{
    public string LeaveTypeId { get; set; } = null!;

    public string PolicyId { get; set; } = null!;

    public decimal AccrualPerMonth { get; set; }

    public decimal AnnualDays { get; set; }

    public decimal CarryForwardMax { get; set; }

    public DateTime? CreatedAt { get; set; }

    public bool Encashable { get; set; }

    public decimal EncashmentMaxDays { get; set; }

    public DateTime? UpdatedAt { get; set; }
}
