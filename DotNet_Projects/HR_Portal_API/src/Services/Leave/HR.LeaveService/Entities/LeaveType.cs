using System;
using System.Collections.Generic;

namespace HR.LeaveService.Entities;

public partial class LeaveType
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public bool Deleted { get; set; }

    public DateTime? DeletedAt { get; set; }

    public bool Active { get; set; }

    public int? AttachmentRequiredFromDays { get; set; }

    public bool BalanceTracked { get; set; }

    public string Code { get; set; } = null!;

    public string? Description { get; set; }

    public string? GenderRestriction { get; set; }

    public bool HalfDayAllowed { get; set; }

    public string Name { get; set; } = null!;

    public bool Paid { get; set; }

    public bool RequiresHrApproval { get; set; }
}
