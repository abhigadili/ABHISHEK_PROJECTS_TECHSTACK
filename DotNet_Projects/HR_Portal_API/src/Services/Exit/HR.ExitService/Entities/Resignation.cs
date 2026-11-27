using System;
using System.Collections.Generic;

namespace HR.ExitService.Entities;

public partial class Resignation
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public DateTime? CompletedAt { get; set; }

    public DateOnly? ConfirmedLastWorkingDay { get; set; }

    public string? DepartmentId { get; set; }

    public string EmployeeId { get; set; } = null!;

    public string? EmployeeName { get; set; }

    public string? HrComment { get; set; }

    public DateOnly? JoiningDate { get; set; }

    public string? ManagerComment { get; set; }

    public string? ManagerId { get; set; }

    public int NoticePeriodDays { get; set; }

    public string Reason { get; set; } = null!;

    public DateOnly RequestedLastWorkingDay { get; set; }

    public string Status { get; set; } = null!;

    public DateOnly SubmittedOn { get; set; }

    public long Version { get; set; }

    public int WaiverDays { get; set; }

    public virtual ICollection<ExitHistory> ExitHistories { get; set; } = new List<ExitHistory>();

    public virtual ExitInterview? ExitInterview { get; set; }

    public virtual ICollection<ExitTask> ExitTasks { get; set; } = new List<ExitTask>();

    public virtual Settlement? Settlement { get; set; }
}
