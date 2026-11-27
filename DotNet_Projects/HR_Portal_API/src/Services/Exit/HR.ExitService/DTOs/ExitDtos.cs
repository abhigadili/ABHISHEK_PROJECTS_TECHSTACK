using System.ComponentModel.DataAnnotations;
using HR.Common.Common;

namespace HR.ExitService.DTOs;

/// <summary>Resignation date validation: shape here; notice-period/waiver rules are policy driven and enforced by the service.</summary>
public sealed record ResignRequest([Required, StringLength(500, MinimumLength = 5)] string Reason, [Required] DateOnly? RequestedLastWorkingDay);
public sealed record DecisionRequest([StringLength(500)] string? Comment);
public sealed record RejectRequest([Required, StringLength(500, MinimumLength = 3)] string Comment);
public sealed record HrConfirmRequest([Required] DateOnly? LastWorkingDay, [Range(0, 365)] int WaiverDays = 0, [StringLength(500)] string? Comment = null);
public sealed record WithdrawRequest([StringLength(255)] string? Reason);
public sealed class ResignationListQuery : PageQuery
{
    [RegularExpression("^(SUBMITTED|MANAGER_APPROVED|MANAGER_REJECTED|HR_CONFIRMED|CLEARED|INTERVIEW_DONE|SETTLEMENT_PENDING|COMPLETED|WITHDRAWN)$")] public string? Status { get; set; }
    public string? EmployeeId { get; set; }
}

public sealed record CompleteTaskRequest([StringLength(500)] string? Remarks, [StringLength(60)] string? AssetTag, [StringLength(60)] string? AssetCondition, DateOnly? ReturnedOn,
    [StringLength(100)] string? SystemName, DateOnly? RevokedOn, [StringLength(190)] string? KtTopic, [StringLength(36)] string? KtTransfereeId);
public sealed record AddTaskRequest([Required, RegularExpression("^(ASSET|ACCESS|KT|CHECKLIST)$")] string TaskType, [Required, StringLength(190, MinimumLength = 3)] string Title, DateOnly? DueDate,
    [StringLength(100)] string? SystemName, [StringLength(60)] string? AssetTag, [StringLength(190)] string? KtTopic);

public sealed record InterviewQuestion([Required, StringLength(20, MinimumLength = 1)] string Id, [Required, StringLength(300, MinimumLength = 3)] string Text, [Required, RegularExpression("^(TEXT|RATING)$")] string Type, bool Required = true);
public sealed class InterviewFormRequest { [Required, StringLength(120)] public string Name { get; set; } = ""; public bool Active { get; set; } = true; [Required, MinLength(1), MaxLength(30)] public List<InterviewQuestion> Questions { get; set; } = []; }
public sealed class InterviewFormUpdateRequest { [StringLength(120)] public string? Name { get; set; } public bool? Active { get; set; } public List<InterviewQuestion>? Questions { get; set; } }
public sealed record InterviewFormDto(string Id, string Name, bool Active, List<InterviewQuestion> Questions);
public sealed record ScheduleInterviewRequest(string? FormId, [Required] DateTime? ScheduledAt);
public sealed record InterviewAnswer([Required] string QuestionId, [Required] System.Text.Json.JsonElement Answer);
public sealed record CompleteInterviewRequest([Required, MinLength(1)] List<InterviewAnswer> Answers, bool? WouldRecommend, [StringLength(500)] string? FeedbackSummary);
public sealed record InterviewDto(string Id, string FormId, DateTime? ScheduledAt, string Status, DateTime? CompletedAt, bool? WouldRecommend, string? FeedbackSummary, string? Answers);

public sealed record SettlementLineRequest([Required, RegularExpression("^(EARNING|DEDUCTION)$")] string Type, [Required, StringLength(40), RegularExpression("^[A-Z0-9_]+$")] string Code,
    [Required, StringLength(255, MinimumLength = 2)] string Description, [Range(0.01, 100_000_000)] decimal Amount);
public sealed record ProcessSettlementRequest([StringLength(100)] string? PaymentReference);
public sealed record PolicyRequest([Range(0, 365)] int DefaultNoticeDays, [Range(0, 365)] int MaxWaiverDays, [Range(28, 31)] int SalaryDaysPerMonth, bool WithdrawalAfterConfirmation);
public sealed record PolicyDto(int DefaultNoticeDays, int MaxWaiverDays, int SalaryDaysPerMonth, bool WithdrawalAfterConfirmation);

public sealed record SettlementLineDto(string Id, string Type, string Code, string Description, decimal Amount);
public sealed record SettlementDto(string Id, string ResignationId, string EmployeeId, string Status, decimal GrossPayable, decimal Recoveries, decimal NetPayable, DateTime? PaidAt, string? PaymentReference,
    object? TenureMonths, object? NoticeShortfallDays, List<SettlementLineDto> Lines);
public sealed record TaskDto(string Id, string TaskType, string Title, string? Department, DateOnly? DueDate, string Status, DateTime? CompletedAt, string? Remarks, string? AssetTag, string? SystemName, string? KtTopic, string? KtTransfereeId);
public sealed record HistoryDto(string Id, string? FromStatus, string ToStatus, string? Comment, DateTime CreatedAt);
public sealed record ProgressDto(int TasksDone, int TasksTotal);
public sealed record ResignationDto(string Id, string EmployeeId, string? EmployeeName, string? ManagerId, string? DepartmentId, DateOnly? JoiningDate, int NoticePeriodDays, string Reason, DateOnly RequestedLastWorkingDay,
    DateOnly SubmittedOn, DateOnly? ConfirmedLastWorkingDay, int WaiverDays, string Status, string? ManagerComment, string? HrComment, DateTime? CompletedAt, long Version);
public sealed record ResignationDetailDto(ResignationDto Resignation, DateOnly? NoticeEnd, ProgressDto Progress, List<TaskDto> Tasks, List<HistoryDto> History, InterviewDto? Interview, SettlementDto? Settlement);

public sealed record EmployeeInfo(string EmployeeId, string EmployeeCode, string FullName, string Status, string? ManagerId, string? DepartmentId, DateOnly? JoiningDate, int NoticePeriodDays);
public sealed record SettlementBasis(decimal MonthlyGross, string Currency);
