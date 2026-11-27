using System.ComponentModel.DataAnnotations;
using HR.Common.Common;

namespace HR.PerformanceService.DTOs;

public sealed class QuestionRequest
{
    [Required, StringLength(80)] public string Section { get; set; } = "";
    [Required, StringLength(300, MinimumLength = 3)] public string Text { get; set; } = "";
    [Required, RegularExpression("^(RATING|TEXT)$")] public string Type { get; set; } = "RATING";
    [Range(0, 10)] public decimal Weight { get; set; } = 1;
    public bool Required { get; set; } = true;
    [Range(1, 1000)] public int OrderNo { get; set; }
}
public sealed class FormRequest : IValidatableObject
{
    [Required, StringLength(120)] public string Name { get; set; } = "";
    [StringLength(255)] public string? Description { get; set; }
    public bool Active { get; set; } = true;
    [Required, MinLength(1), MaxLength(60)] public List<QuestionRequest> Questions { get; set; } = [];
    public IEnumerable<ValidationResult> Validate(ValidationContext c) { if (Questions.Select(q => q.OrderNo).Distinct().Count() != Questions.Count) yield return new("Question order numbers must be unique", [nameof(Questions)]); }
}
public sealed class FormUpdateRequest { [StringLength(120)] public string? Name { get; set; } [StringLength(255)] public string? Description { get; set; } public bool? Active { get; set; } [MaxLength(60)] public List<QuestionRequest>? Questions { get; set; } }
public sealed record QuestionDto(string Id, string Section, string Text, string Type, decimal Weight, bool Required, int OrderNo);
public sealed record FormDto(string Id, string Name, string? Description, bool Active, List<QuestionDto> Questions);

public sealed class CycleRequest : IValidatableObject
{
    [Required, StringLength(120)] public string Name { get; set; } = "";
    [Required, RegularExpression("^(ANNUAL|HALF_YEARLY|QUARTERLY|PROBATION)$")] public string Type { get; set; } = "";
    [Required, StringLength(36, MinimumLength = 36)] public string FormId { get; set; } = "";
    [Required] public DateOnly? PeriodStart { get; set; }
    [Required] public DateOnly? PeriodEnd { get; set; }
    [Required] public DateOnly? SelfEvalDeadline { get; set; }
    [Required] public DateOnly? ManagerEvalDeadline { get; set; }
    public IEnumerable<ValidationResult> Validate(ValidationContext c)
    {
        if (PeriodEnd < PeriodStart) yield return new("periodEnd must not precede periodStart", [nameof(PeriodEnd)]);
        if (!(SelfEvalDeadline >= PeriodStart && ManagerEvalDeadline >= SelfEvalDeadline)) yield return new("Deadlines must be ordered: period start <= self <= manager", [nameof(ManagerEvalDeadline)]);
    }
}
public sealed record CycleDto(string Id, string Name, string Type, string FormId, DateOnly PeriodStart, DateOnly PeriodEnd, DateOnly SelfEvalDeadline, DateOnly ManagerEvalDeadline, string Status);
public sealed record ActivateResultDto(CycleDto Cycle, int Reviews);
public sealed record CloseResultDto(CycleDto Cycle, int OpenReviews);
public sealed record ReminderResultDto(int SelfReminders, int ManagerReminders);

public sealed record AnswerRequest([Required, StringLength(36, MinimumLength = 36)] string QuestionId, [Range(1, 5)] decimal? Rating, [StringLength(2000)] string? AnswerText);
public sealed record AnswersRequest([Required, MinLength(1)] List<AnswerRequest> Answers);
public sealed record SelfSubmitRequest([StringLength(3000)] string? Achievements, [StringLength(2000)] string? Strengths, [StringLength(2000)] string? ImprovementAreas);
public sealed record ManagerSubmitRequest([Required, StringLength(3000, MinimumLength = 3)] string ManagerFeedback, [StringLength(2000)] string? Strengths, [StringLength(2000)] string? ImprovementAreas);
public sealed record ApproveReviewRequest([StringLength(1000)] string? HrComment, [Range(1, 5)] decimal? FinalRating);
public sealed class ReviewListQuery : PageQuery
{
    public string? CycleId { get; set; }
    [RegularExpression("^(SELF_PENDING|SELF_SUBMITTED|MANAGER_SUBMITTED|APPROVED)$")] public string? Status { get; set; }
    public string? EmployeeId { get; set; }
}
public sealed record ReviewSummaryDto(string Id, string CycleId, string EmployeeId, string? EmployeeName, string? ManagerId, string Status, decimal? SelfRating, decimal? ManagerRating, decimal? FinalRating,
    DateTime? SelfSubmittedAt, DateTime? ManagerSubmittedAt, DateTime? ApprovedAt);
public sealed record AnswerDto(string Id, string QuestionId, string Respondent, decimal? Rating, string? AnswerText);
public sealed record ReviewHistoryDto(string Id, string Action, string? Status, string? Comment, DateTime CreatedAt);
public sealed record ReviewDetailDto(string Id, string CycleId, string EmployeeId, string? EmployeeName, string? ManagerId, string Status, decimal? SelfRating, decimal? ManagerRating, decimal? FinalRating,
    string? Achievements, string? Strengths, string? ImprovementAreas, string? ManagerFeedback, string? HrComment, DateTime? ApprovedAt, CycleDto? Cycle, List<QuestionDto> Questions, List<AnswerDto> Answers, List<ReviewHistoryDto> History);
public sealed record StatusCountDto(string Status, int Reviews);
public sealed record DepartmentRatingDto(string? DepartmentId, int Reviews, decimal? AvgFinal);
public sealed record BucketDto(int Bucket, int Employees);
public sealed record CycleReportDto(CycleDto Cycle, int TotalReviews, List<StatusCountDto> ByStatus, decimal? AvgSelf, decimal? AvgManager, decimal? AvgFinal, List<DepartmentRatingDto> ByDepartment, List<BucketDto> RatingDistribution);
public sealed record EmployeeReviewHistoryDto(string Id, string CycleId, string CycleName, string Status, decimal? SelfRating, decimal? ManagerRating, decimal? FinalRating, DateTime? ApprovedAt);

public sealed class GoalRequest
{
    [Required, StringLength(200, MinimumLength = 3)] public string Title { get; set; } = "";
    [StringLength(1000)] public string? Description { get; set; }
    [RegularExpression("^(GOAL|OKR)$")] public string Type { get; set; } = "GOAL";
    [StringLength(36, MinimumLength = 36)] public string? CycleId { get; set; }
    public DateOnly? TargetDate { get; set; }
    [Range(1, 100)] public int Weight { get; set; } = 10;
}
public sealed class GoalUpdateRequest
{
    [StringLength(200, MinimumLength = 3)] public string? Title { get; set; }
    [StringLength(1000)] public string? Description { get; set; }
    [RegularExpression("^(GOAL|OKR)$")] public string? Type { get; set; }
    [StringLength(36, MinimumLength = 36)] public string? CycleId { get; set; }
    public DateOnly? TargetDate { get; set; }
    [Range(1, 100)] public int? Weight { get; set; }
    [Range(0, 100)] public int? Progress { get; set; }
    [RegularExpression("^(NOT_STARTED|IN_PROGRESS|COMPLETED|CANCELLED)$")] public string? Status { get; set; }
}
public sealed record KeyResultRequest([Required, StringLength(300, MinimumLength = 3)] string Description, [Range(0.0001, double.MaxValue)] decimal TargetValue, [Range(0, double.MaxValue)] decimal CurrentValue = 0, [StringLength(30)] string? Unit = null);
public sealed record KeyResultUpdateRequest([Range(0, double.MaxValue)] decimal CurrentValue, [StringLength(300, MinimumLength = 3)] string? Description, [Range(0.0001, double.MaxValue)] decimal? TargetValue);
public sealed record KeyResultDto(string Id, string GoalId, string Description, decimal TargetValue, decimal CurrentValue, string? Unit);
public sealed record GoalDto(string Id, string EmployeeId, string Title, string? Description, string Type, string? CycleId, DateOnly? TargetDate, int Weight, int Progress, string Status, List<KeyResultDto> KeyResults);
public sealed class GoalListQuery { public string? EmployeeId { get; set; } public string? CycleId { get; set; } }
public sealed record FeedbackRequest([Required, StringLength(36, MinimumLength = 36)] string ToEmployeeId, [Required, RegularExpression("^(PEER|MANAGER)$")] string Type, [Required, StringLength(2000, MinimumLength = 3)] string Comment, [Range(1, 5)] decimal? Rating, [StringLength(36)] string? ReviewId);
public sealed record FeedbackDto(string Id, string? FromEmployeeId, string ToEmployeeId, string Type, string Comment, decimal? Rating, string? ReviewId, DateTime CreatedAt);
