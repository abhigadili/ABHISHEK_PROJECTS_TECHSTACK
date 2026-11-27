using System;
using System.Collections.Generic;

namespace HR.LeaveService.Entities;

public partial class LeavePolicy
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public bool Deleted { get; set; }

    public DateTime? DeletedAt { get; set; }

    public bool Active { get; set; }

    public bool IsDefault { get; set; }

    public string? Description { get; set; }

    public int HrApprovalThresholdDays { get; set; }

    public string Name { get; set; } = null!;
}
