using System;
using System.Collections.Generic;

namespace HR.ExitService.Entities;

public partial class ExitPolicy
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public int DefaultNoticeDays { get; set; }

    public int MaxWaiverDays { get; set; }

    public int SalaryDaysPerMonth { get; set; }

    public bool WithdrawalAfterConfirmation { get; set; }
}
