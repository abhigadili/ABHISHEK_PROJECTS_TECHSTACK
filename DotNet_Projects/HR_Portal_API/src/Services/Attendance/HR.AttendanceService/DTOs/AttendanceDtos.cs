using System.ComponentModel.DataAnnotations;
using HR.Common.Common;

namespace HR.AttendanceService.DTOs;

public sealed record CheckInRequest([RegularExpression("^(OFFICE|WFH)$")] string WorkMode = "OFFICE", [StringLength(255)] string? Remarks = null);
public sealed record CheckOutRequest([StringLength(255)] string? Remarks);

public sealed class CorrectionRequestDto : IValidatableObject
{
    [Required] public DateOnly? WorkDate { get; set; }
    [Required] public DateTime? RequestedCheckIn { get; set; }
    [Required] public DateTime? RequestedCheckOut { get; set; }
    [Required, StringLength(500, MinimumLength = 5)] public string Reason { get; set; } = "";
    public IEnumerable<ValidationResult> Validate(ValidationContext c)
    {
        if (RequestedCheckOut <= RequestedCheckIn) yield return new("requestedCheckOut must be after requestedCheckIn", [nameof(RequestedCheckOut)]);
    }
}

public sealed class WfhRequestDto : IValidatableObject
{
    [Required] public DateOnly? FromDate { get; set; }
    [Required] public DateOnly? ToDate { get; set; }
    [Required, StringLength(500, MinimumLength = 5)] public string Reason { get; set; } = "";
    public IEnumerable<ValidationResult> Validate(ValidationContext c) { if (ToDate < FromDate) yield return new("toDate must not precede fromDate", [nameof(ToDate)]); }
}

public sealed record DecisionRequest([StringLength(500)] string? Comment);
public sealed record RejectRequest([Required, StringLength(500, MinimumLength = 3)] string Comment);

public sealed class AssignShiftRequest : IValidatableObject
{
    [Required, MinLength(1), MaxLength(500)] public List<string> EmployeeIds { get; set; } = [];
    [Required, StringLength(36, MinimumLength = 36)] public string ShiftId { get; set; } = "";
    [Required] public DateOnly? EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public IEnumerable<ValidationResult> Validate(ValidationContext c) { if (EffectiveTo < EffectiveFrom) yield return new("effectiveTo must not precede effectiveFrom", [nameof(EffectiveTo)]); }
}
public sealed record SyncHolidaysRequest([Range(2000, 2100)] int Year);

public sealed class RecordsQuery : PageQuery
{
    public string? EmployeeId { get; set; }
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
    [RegularExpression("^(PRESENT|HALF_DAY|ABSENT|MISSING_PUNCH)$")] public string? Status { get; set; }
}
public sealed class MonthQuery { [RegularExpression(@"^\d{4}-(0[1-9]|1[0-2])$")] public string? Month { get; set; } public string? EmployeeId { get; set; } public bool Refresh { get; set; } }
public sealed class TeamQuery { [RegularExpression(@"^\d{4}-(0[1-9]|1[0-2])$")] public string? Month { get; set; } public DateOnly? Date { get; set; } }
public sealed class RequestListQuery : PageQuery { [RegularExpression("^(PENDING|APPROVED|REJECTED|CANCELLED)$")] public string? Status { get; set; } public string? EmployeeId { get; set; } }
public sealed class PayrollInputQuery { [Required] public string EmployeeId { get; set; } = ""; [Required, RegularExpression(@"^\d{4}-(0[1-9]|1[0-2])$")] public string Month { get; set; } = ""; }

public sealed record AttendanceRecordDto(string Id, string EmployeeId, DateOnly WorkDate, DateTime? CheckIn, DateTime? CheckOut, string Status, string WorkMode, string? ShiftId, int WorkedMinutes,
    int LateMinutes, int EarlyDepartureMinutes, int OvertimeMinutes, string Source, string? Remarks);
public sealed record ShiftLite(string Id, string Code, string Name, TimeOnly StartTime, TimeOnly EndTime, string WeeklyOffs);
public sealed record HolidayLite(string HolidayId, DateOnly HolidayDate, string? Name);
public sealed record TodayDto(DateOnly Date, AttendanceRecordDto? Record, HolidayLite? Holiday, bool OnLeave, ShiftLite? Shift, bool Weekend);
public sealed record MonthlySummaryDto(string EmployeeId, int SummaryYear, int SummaryMonth, int WorkingDays, int PresentDays, int HalfDays, int AbsentDays, int LeaveDays, int Holidays, int WeeklyOffs,
    int WfhDays, int MissingPunches, int LateCount, int OvertimeMinutes, decimal? AttendancePercent, DateTime GeneratedAt);
public sealed record MonthlyDto(string EmployeeId, string Month, MonthlySummaryDto? Summary, List<AttendanceRecordDto> Records);
public sealed record CalendarDayDto(DateOnly Date, string Type, string? Holiday, DateTime? CheckIn, DateTime? CheckOut, int WorkedMinutes, string? WorkMode);
public sealed record TeamMemberDay(string Status, DateTime? CheckIn, DateTime? CheckOut, string? WorkMode);
public sealed record TeamMonthTotals(int Count, long WorkedMinutes, long LateMinutes, long OvertimeMinutes);
public sealed record TeamMemberDto(string EmployeeId, string? FullName, TeamMemberDay Today, TeamMonthTotals Month);
public sealed record TeamReportDto(DateOnly Date, string Month, int Headcount, int Present, List<TeamMemberDto> Members);
public sealed record PayrollInputDto(string EmployeeId, string Month, int WorkingDays, int PresentDays, int HalfDays, int AbsentDays, int LeaveDays, int Holidays, int OvertimeMinutes);
public sealed record CorrectionDto(string Id, string EmployeeId, string? EmployeeName, string? ManagerId, DateOnly WorkDate, DateTime RequestedCheckIn, DateTime RequestedCheckOut, string Reason, string Status,
    bool Escalated, string? ReviewComment, DateTime? ReviewedAt, DateTime CreatedAt);
public sealed record WfhDto(string Id, string EmployeeId, string? EmployeeName, string? ManagerId, DateOnly FromDate, DateOnly ToDate, string Reason, string Status, string? ReviewComment, DateTime? ReviewedAt, DateTime CreatedAt);
public sealed record ShiftAssignmentDto(string Id, string EmployeeId, string ShiftId, DateOnly EffectiveFrom, DateOnly? EffectiveTo);
public sealed record AssignedDto(int Assigned);
public sealed record SyncResultDto(int Year, int Synced);
