using System.ComponentModel.DataAnnotations;
using HR.Common.Common;

namespace HR.TimesheetService.DTOs;

/// <summary>Timesheet hours validator: quarter-hour multiples between 0.25 and 24.</summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter)]
public sealed class QuarterHoursAttribute : ValidationAttribute
{
    public override bool IsValid(object? value) => value is null || (value is decimal h && h >= 0.25m && h <= 24 && h * 4 % 1 == 0);
    public override string FormatErrorMessage(string name) => "Hours must be between 0.25 and 24 in 0.25 steps";
}

public sealed class EntryRequest : IValidatableObject
{
    [Required, StringLength(36, MinimumLength = 36)] public string ProjectId { get; set; } = "";
    [StringLength(36, MinimumLength = 36)] public string? TaskId { get; set; }
    [StringLength(60)] public string? TaskKey { get; set; }
    [Required] public DateOnly? WorkDate { get; set; }
    [Required, QuarterHours] public decimal? Hours { get; set; }
    public bool Billable { get; set; } = true;
    [StringLength(500)] public string? Description { get; set; }
    public IEnumerable<ValidationResult> Validate(ValidationContext c) { if (TaskId is null && string.IsNullOrWhiteSpace(TaskKey)) yield return new("Either taskId or taskKey is required", [nameof(TaskKey)]); }
}
public sealed record SaveWeekRequest([Required, MaxLength(200)] List<EntryRequest> Entries);
public sealed record DecisionRequest([StringLength(500)] string? Comment);
public sealed record RejectRequest([Required, StringLength(500, MinimumLength = 3)] string Comment);
public sealed record ReopenRequest([Required, StringLength(255, MinimumLength = 3)] string Reason);
public sealed class TimesheetListQuery : PageQuery
{
    [RegularExpression("^(DRAFT|SUBMITTED|APPROVED|REJECTED)$")] public string? Status { get; set; }
    public string? EmployeeId { get; set; }
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
}
public sealed class RangeQuery : IValidatableObject
{
    [Required] public DateOnly? From { get; set; }
    [Required] public DateOnly? To { get; set; }
    public string? EmployeeId { get; set; }
    public IEnumerable<ValidationResult> Validate(ValidationContext c) { if (To < From) yield return new("to must not precede from", [nameof(To)]); }
}
public sealed record TaskRequest([Required, StringLength(40, MinimumLength = 1), RegularExpression("^[A-Za-z0-9_-]+$")] string Code, [Required, StringLength(150)] string Name, bool Billable = true, bool Active = true);
public sealed class TaskUpdateRequest { [StringLength(150)] public string? Name { get; set; } public bool? Billable { get; set; } public bool? Active { get; set; } }

public sealed record TimesheetDto(string Id, string EmployeeId, string? EmployeeName, DateOnly WeekStart, string Status, decimal TotalHours, decimal BillableHours, string? ApproverId, DateTime? SubmittedAt,
    DateTime? DecidedAt, string? DecisionComment, int ResubmissionCount, long Version);
public sealed record EntryDto(string Id, string ProjectId, string? TaskId, string TaskKey, DateOnly WorkDate, decimal Hours, bool Billable, string? Description);
public sealed record DailyTotalDto(DateOnly Date, decimal Hours);
public sealed record HistoryDto(string Id, string Action, string? ActorId, string? Comment, DateTime CreatedAt);
public sealed record TimesheetViewDto(TimesheetDto? Timesheet, DateOnly WeekStart, string? EmployeeId, string Status, List<EntryDto> Entries, List<DailyTotalDto> DailyTotals, List<HistoryDto> History, decimal TotalHours);
public sealed record ProjectHoursDto(string ProjectId, decimal TotalHours, decimal BillableHours);
public sealed record EmployeeHoursSummaryDto(string EmployeeId, DateOnly From, DateOnly To, List<Dictionary<string, object?>> Summary, List<ProjectHoursDto> ByProject);
public sealed record EmployeeHoursDto(string EmployeeId, string? EmployeeName, decimal TotalHours, decimal BillableHours);
public sealed record ProjectSummaryDto(string ProjectId, DateOnly From, DateOnly To, decimal TotalHours, decimal BillableHours, List<EmployeeHoursDto> ByEmployee);
public sealed record TaskDto(string Id, string ProjectId, string Code, string Name, bool Billable, bool Active);
public sealed record AllocationCheck(string ProjectId, string ProjectCode, string ProjectStatus, string ProjectManagerId, bool Allocated, decimal AllocationPercent, bool Billable);
