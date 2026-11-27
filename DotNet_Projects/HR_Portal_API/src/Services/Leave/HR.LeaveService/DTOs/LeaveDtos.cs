using System.ComponentModel.DataAnnotations;
using HR.Common.Common;

namespace HR.LeaveService.DTOs;

public sealed record AttachmentRef([Required, StringLength(36, MinimumLength = 36)] string DocumentId, [StringLength(190)] string? FileName);

/// <summary>Apply for leave. Custom validation: date range order and "no request spans two calendar years".</summary>
public sealed class ApplyLeaveRequest : IValidatableObject
{
    [Required, StringLength(36, MinimumLength = 36)] public string LeaveTypeId { get; set; } = "";
    [Required] public DateOnly? FromDate { get; set; }
    [Required] public DateOnly? ToDate { get; set; }
    public bool HalfDayStart { get; set; }
    public bool HalfDayEnd { get; set; }
    [StringLength(500)] public string? Reason { get; set; }
    [MaxLength(5)] public List<AttachmentRef> Attachments { get; set; } = [];
    [StringLength(36, MinimumLength = 36)] public string? EmployeeId { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext c)
    {
        if (ToDate < FromDate) yield return new("toDate must not precede fromDate", [nameof(ToDate)]);
        else if (FromDate?.Year != ToDate?.Year) yield return new("A leave request cannot span two calendar years; split it", [nameof(ToDate)]);
    }
}

public sealed class UpdateLeaveRequest
{
    [StringLength(36, MinimumLength = 36)] public string? LeaveTypeId { get; set; }
    public DateOnly? FromDate { get; set; }
    public DateOnly? ToDate { get; set; }
    public bool? HalfDayStart { get; set; }
    public bool? HalfDayEnd { get; set; }
    [StringLength(500)] public string? Reason { get; set; }
}

public sealed record DecisionRequest([StringLength(500)] string? Comment);
public sealed record RejectRequest([Required, StringLength(500, MinimumLength = 3)] string Comment);
public sealed record CancelRequest([Required, StringLength(500, MinimumLength = 3)] string Reason);
public sealed record CommentRequest([Required, StringLength(1000, MinimumLength = 1)] string Comment);

public sealed class LeaveListQuery : PageQuery
{
    [RegularExpression("^(PENDING|APPROVED|REJECTED|CANCELLED|WITHDRAWN)$")] public string? Status { get; set; }
    [RegularExpression("^(MANAGER|HR|COMPLETE)$")] public string? Stage { get; set; }
    public string? EmployeeId { get; set; }
    public string? LeaveTypeId { get; set; }
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
}

public sealed class CalendarQuery : IValidatableObject
{
    [Required] public DateOnly? From { get; set; }
    [Required] public DateOnly? To { get; set; }
    public string? EmployeeId { get; set; }
    public IEnumerable<ValidationResult> Validate(ValidationContext c)
    {
        if (To < From) yield return new("to must not precede from", [nameof(To)]);
        else if (To!.Value.DayNumber - From!.Value.DayNumber > 366) yield return new("Calendar range cannot exceed one year", [nameof(To)]);
    }
}

public sealed class YearQuery { [Range(2000, 2100)] public int? Year { get; set; } }

public sealed record LeaveApplicationDto(string Id, string EmployeeId, string? EmployeeName, string LeaveTypeId, DateOnly FromDate, DateOnly ToDate, decimal Days, bool HalfDayStart, bool HalfDayEnd,
    string? Reason, string Status, string Stage, string? ManagerId, DateTime AppliedAt, DateTime? DecidedAt, bool CancelRequested, string? CancelReason, long Version);
public sealed record ApprovalDto(string Id, string Action, string Stage, string? ActorId, string? Comment, DateTime CreatedAt);
public sealed record CommentDto(string Id, string? AuthorId, string Comment, DateTime CreatedAt);
public sealed record AttachmentDto(string Id, string DocumentId, string? FileName);
public sealed record LeaveDetailDto(LeaveApplicationDto Application, string? LeaveTypeCode, string? LeaveTypeName, List<ApprovalDto> Approvals, List<CommentDto> Comments, List<AttachmentDto> Attachments);

public sealed record CalendarEntryDto(string Id, string EmployeeId, string? EmployeeName, DateOnly FromDate, DateOnly ToDate, decimal Days, string Status, string LeaveTypeCode, string LeaveTypeName);
public sealed record LeaveMonthlySummaryDto(string EmployeeId, string Month, decimal PaidLeaveDays, decimal UnpaidLeaveDays, List<MonthlyLeaveByType> ByType);
public sealed record MonthlyLeaveByType(string Code, bool Paid, decimal Days);

public sealed record BalanceDto(string EmployeeId, string LeaveTypeId, string LeaveTypeCode, string LeaveTypeName, int BalanceYear, decimal Opening, decimal Accrued, decimal CarriedForward, decimal Adjusted,
    decimal Used, decimal Pending, decimal Encashed, decimal Entitled, decimal Available, bool Paid, bool BalanceTracked);
public sealed record BalanceHistoryDto(long Id, string LeaveTypeCode, int BalanceYear, decimal? OldPending, decimal? NewPending, decimal? OldUsed, decimal? NewUsed, decimal? OldAccrued, decimal? NewAccrued,
    decimal? OldCarried, decimal? NewCarried, decimal? OldEncashed, decimal? NewEncashed, DateTime ChangedAt, string? ChangedBy);

public sealed class AdjustBalanceRequest : IValidatableObject
{
    [Required, StringLength(36, MinimumLength = 36)] public string EmployeeId { get; set; } = "";
    [Required, StringLength(36, MinimumLength = 36)] public string LeaveTypeId { get; set; } = "";
    [Range(2000, 2100)] public int Year { get; set; }
    [Range(-366, 366)] public decimal Days { get; set; }
    [Required, StringLength(255, MinimumLength = 3)] public string Reason { get; set; } = "";
    public IEnumerable<ValidationResult> Validate(ValidationContext c) { if (Days == 0) yield return new("days must be non-zero", [nameof(Days)]); }
}
public sealed class EncashRequest { [Required, StringLength(36, MinimumLength = 36)] public string EmployeeId { get; set; } = ""; [Required, StringLength(36, MinimumLength = 36)] public string LeaveTypeId { get; set; } = ""; [Range(2000, 2100)] public int Year { get; set; } [Range(0.5, 366)] public decimal Days { get; set; } }
public sealed record AccrualRunRequest([Range(2000, 2100)] int Year, [Range(1, 12)] int Month);
public sealed record YearRunRequest([Range(2000, 2100)] int Year);
public sealed record RunResultDto(string RunKey, int Employees, int Records);

public sealed class EntitlementRequest
{
    [Required, StringLength(36, MinimumLength = 36)] public string LeaveTypeId { get; set; } = "";
    [Range(0, 366)] public decimal AnnualDays { get; set; }
    [Range(0, 31)] public decimal AccrualPerMonth { get; set; }
    [Range(0, 366)] public decimal CarryForwardMax { get; set; }
    public bool Encashable { get; set; }
    [Range(0, 366)] public decimal EncashmentMaxDays { get; set; }
}
public sealed class PolicyRequest
{
    [Required, StringLength(120)] public string Name { get; set; } = "";
    [StringLength(255)] public string? Description { get; set; }
    [Range(0, 366)] public int HrApprovalThresholdDays { get; set; } = 5;
    public bool IsDefault { get; set; }
    public bool Active { get; set; } = true;
    public List<EntitlementRequest> Entitlements { get; set; } = [];
}
public sealed class PolicyUpdateRequest
{
    [StringLength(120)] public string? Name { get; set; }
    [StringLength(255)] public string? Description { get; set; }
    [Range(0, 366)] public int? HrApprovalThresholdDays { get; set; }
    public bool? IsDefault { get; set; }
    public bool? Active { get; set; }
    public List<EntitlementRequest>? Entitlements { get; set; }
}
public sealed record EntitlementDto(string LeaveTypeId, string LeaveTypeCode, string LeaveTypeName, decimal AnnualDays, decimal AccrualPerMonth, decimal CarryForwardMax, bool Encashable, decimal EncashmentMaxDays);
public sealed record PolicyDto(string Id, string Name, string? Description, int HrApprovalThresholdDays, bool IsDefault, bool Active, List<EntitlementDto> Entitlements);
public sealed record LeaveOverviewDto(List<BalanceDto>? Balances, List<CalendarEntryDto>? Upcoming, List<LeaveApplicationDto>? Pending, List<string> Unavailable);
public sealed record EmployeeLite(string EmployeeId, string FullName, string? ManagerId, string? DepartmentId, string? LocationId, string Status, string? Gender, DateOnly? JoiningDate);
