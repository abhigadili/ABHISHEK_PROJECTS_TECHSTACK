using HR.Common.Common;
using HR.Common.Data;
using HR.Common.Messaging;
using HR.Common.Security;
using HR.PerformanceService.Data;
using HR.PerformanceService.DTOs;
using HR.PerformanceService.Entities;
using Mapster;
using Microsoft.EntityFrameworkCore;

namespace HR.PerformanceService.Services;

public interface IReviewService
{
    Task<List<FormDto>> ListFormsAsync(CancellationToken ct);
    Task<FormDto> GetFormAsync(string id, CancellationToken ct);
    Task<FormDto> CreateFormAsync(FormRequest r, CancellationToken ct);
    Task<FormDto> UpdateFormAsync(string id, FormUpdateRequest r, CancellationToken ct);
    Task<List<CycleDto>> ListCyclesAsync(string? status, CancellationToken ct);
    Task<CycleDto> CreateCycleAsync(CycleRequest r, CancellationToken ct);
    Task<ActivateResultDto> ActivateCycleAsync(string id, CancellationToken ct);
    Task<CloseResultDto> CloseCycleAsync(string id, CancellationToken ct);
    Task<ReminderResultDto> SendRemindersAsync(string cycleId, CancellationToken ct);
    Task<PagedResult<ReviewSummaryDto>> ListAsync(ReviewListQuery q, CancellationToken ct);
    Task<ReviewDetailDto> GetAsync(string id, CancellationToken ct);
    Task<ReviewDetailDto?> MyCurrentAsync(CancellationToken ct);
    Task<ReviewDetailDto> SaveAnswersAsync(string id, string respondent, List<AnswerRequest> answers, CancellationToken ct);
    Task<ReviewDetailDto> SubmitSelfAsync(string id, SelfSubmitRequest r, CancellationToken ct);
    Task<ReviewDetailDto> SubmitManagerAsync(string id, ManagerSubmitRequest r, CancellationToken ct);
    Task<ReviewDetailDto> ApproveAsync(string id, ApproveReviewRequest r, CancellationToken ct);
    Task<CycleReportDto> CycleReportAsync(string cycleId, CancellationToken ct);
    Task<List<EmployeeReviewHistoryDto>> EmployeeHistoryAsync(string employeeId, CancellationToken ct);
}

/// <summary>
/// Review workflow (State pattern): SELF_PENDING -> SELF_SUBMITTED -> MANAGER_SUBMITTED -> APPROVED. Forms are configurable (questions, weights);
/// the weighted rating is computed from the form; the final rating blends manager and self ratings by a configurable weight.
/// </summary>
public sealed class ReviewService(PerformanceDbContext db, ICurrentUser user, IEventPublisher events, IAuditWriter audit, IUnitOfWork uow, IConfiguration cfg) : IReviewService
{
    private decimal ManagerWeight => cfg.GetValue("Performance:ManagerWeight", 0.7m);
    private static QuestionDto ToDto(FormQuestion q) => new(q.Id, q.Section, q.Text, q.Type, q.Weight, q.Required, q.OrderNo);
    private static CycleDto ToDto(ReviewCycle c) => c.Adapt<CycleDto>();
    private bool IsManage => user.HasPermission(Perm.PerformanceManage) || user.IsSuperAdmin;

    // ------------------------------------------------------------------ evaluation forms
    public async Task<List<FormDto>> ListFormsAsync(CancellationToken ct)
    {
        var forms = await db.EvaluationForms.AsNoTracking().OrderBy(f => f.Name).ToListAsync(ct);
        var qs = (await db.FormQuestions.AsNoTracking().OrderBy(q => q.OrderNo).ToListAsync(ct)).ToLookup(q => q.FormId);
        return forms.Select(f => new FormDto(f.Id, f.Name, f.Description, f.Active, qs[f.Id].Select(ToDto).ToList())).ToList();
    }

    public async Task<FormDto> GetFormAsync(string id, CancellationToken ct)
    {
        var f = await db.EvaluationForms.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Evaluation form not found");
        var qs = await db.FormQuestions.AsNoTracking().Where(q => q.FormId == id).OrderBy(q => q.OrderNo).ToListAsync(ct);
        return new FormDto(f.Id, f.Name, f.Description, f.Active, qs.Select(ToDto).ToList());
    }

    private void AddQuestions(string formId, IEnumerable<QuestionRequest> qs)
    {
        foreach (var q in qs) db.FormQuestions.Add(new FormQuestion { FormId = formId, Section = q.Section, Text = q.Text, Type = q.Type, Weight = q.Weight, Required = q.Required, OrderNo = q.OrderNo });
    }

    public async Task<FormDto> CreateFormAsync(FormRequest r, CancellationToken ct)
    {
        var f = new EvaluationForm { Name = r.Name, Description = r.Description, Active = r.Active };
        await uow.ExecuteAsync(async () =>
        {
            db.EvaluationForms.Add(f);
            await db.SaveChangesAsync(ct);
            AddQuestions(f.Id, r.Questions);
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("EvaluationForm", f.Id, "CREATED", null, new { r.Name });
        }, ct);
        return await GetFormAsync(f.Id, ct);
    }

    public async Task<FormDto> UpdateFormAsync(string id, FormUpdateRequest r, CancellationToken ct)
    {
        var f = await db.EvaluationForms.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Evaluation form not found");
        if (r.Questions is not null && await db.ReviewCycles.AnyAsync(c => c.FormId == id && c.Status != "DRAFT", ct)) throw new BusinessRuleException("Form is used by an active/closed cycle; clone it instead of editing");
        await uow.ExecuteAsync(async () =>
        {
            f.Name = r.Name ?? f.Name; f.Description = r.Description ?? f.Description; if (r.Active is { } a) f.Active = a;
            if (r.Questions is not null)
            {
                db.FormQuestions.RemoveRange(await db.FormQuestions.Where(q => q.FormId == id).ToListAsync(ct));
                await db.SaveChangesAsync(ct);
                AddQuestions(id, r.Questions);
            }
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("EvaluationForm", id, "UPDATED");
        }, ct);
        return await GetFormAsync(id, ct);
    }

    // ------------------------------------------------------------------ cycles
    public async Task<List<CycleDto>> ListCyclesAsync(string? status, CancellationToken ct) =>
        (await db.ReviewCycles.AsNoTracking().Where(c => status == null || c.Status == status).OrderByDescending(c => c.PeriodStart).ToListAsync(ct)).Select(ToDto).ToList();

    public async Task<CycleDto> CreateCycleAsync(CycleRequest r, CancellationToken ct)
    {
        if (!await db.EvaluationForms.AnyAsync(f => f.Id == r.FormId, ct)) throw new NotFoundException("Evaluation form not found");
        var c = new ReviewCycle { Name = r.Name, Type = r.Type, FormId = r.FormId, PeriodStart = r.PeriodStart!.Value, PeriodEnd = r.PeriodEnd!.Value, SelfEvalDeadline = r.SelfEvalDeadline!.Value, ManagerEvalDeadline = r.ManagerEvalDeadline!.Value, Status = "DRAFT" };
        db.ReviewCycles.Add(c);
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync("ReviewCycle", c.Id, "CREATED");
        return ToDto(c);
    }

    /// <summary>Activating a cycle creates one review per active employee (idempotent) and notifies them.</summary>
    public async Task<ActivateResultDto> ActivateCycleAsync(string id, CancellationToken ct)
    {
        var c = await db.ReviewCycles.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Review cycle not found");
        if (c.Status != "DRAFT") throw new BusinessRuleException($"Cycle is already {c.Status}");
        var emps = await db.PerfEmployees.AsNoTracking().Where(e => e.Status == "ACTIVE" || e.Status == "ON_NOTICE").ToListAsync(ct);
        if (emps.Count == 0) throw new BusinessRuleException("No active employees to review");
        var existing = (await db.PerformanceReviews.AsNoTracking().Where(r => r.CycleId == id).Select(r => r.EmployeeId).ToListAsync(ct)).ToHashSet();
        await uow.ExecuteAsync(async () =>
        {
            c.Status = "ACTIVE";
            foreach (var e in emps.Where(e => !existing.Contains(e.EmployeeId)))
            {
                var r = new PerformanceReview { CycleId = id, EmployeeId = e.EmployeeId, EmployeeName = e.FullName, ManagerId = e.ManagerId, FormId = c.FormId, Status = "SELF_PENDING" };
                db.PerformanceReviews.Add(r);
                await db.SaveChangesAsync(ct);
                db.ReviewHistories.Add(new ReviewHistory { ReviewId = r.Id, Action = "CREATED", Status = "SELF_PENDING" });
                events.Publish(Topics.NotificationRequested, e.EmployeeId, new NotificationRequestedEvent(e.EmployeeId, null, "PERFORMANCE_REVIEW_STARTED", "IN_APP", $"Performance review: {c.Name}",
                    $"Your self evaluation is due by {c.SelfEvalDeadline:yyyy-MM-dd}.", null, "ReviewCycle", id, $"perf-start:{id}:{e.EmployeeId}"));
            }
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("ReviewCycle", id, "ACTIVATED", null, new { reviews = emps.Count });
        }, ct);
        return new ActivateResultDto(ToDto(c), emps.Count);
    }

    public async Task<CloseResultDto> CloseCycleAsync(string id, CancellationToken ct)
    {
        var c = await db.ReviewCycles.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Review cycle not found");
        if (c.Status != "ACTIVE") throw new BusinessRuleException("Only ACTIVE cycles can be closed");
        var open = await db.PerformanceReviews.CountAsync(r => r.CycleId == id && (r.Status == "SELF_PENDING" || r.Status == "SELF_SUBMITTED" || r.Status == "MANAGER_SUBMITTED"), ct);
        c.Status = "CLOSED";
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync("ReviewCycle", id, "CLOSED", null, new { openReviews = open });
        return new CloseResultDto(ToDto(c), open);
    }

    /// <summary>Reminder notifications for pending work, deduplicated per day through the dedup key.</summary>
    public async Task<ReminderResultDto> SendRemindersAsync(string cycleId, CancellationToken ct)
    {
        var c = await db.ReviewCycles.AsNoTracking().FirstOrDefaultAsync(x => x.Id == cycleId, ct) ?? throw new NotFoundException("Review cycle not found");
        var pendingSelf = await db.PerformanceReviews.AsNoTracking().Where(r => r.CycleId == cycleId && r.Status == "SELF_PENDING").ToListAsync(ct);
        var pendingMgr = await db.PerformanceReviews.AsNoTracking().Where(r => r.CycleId == cycleId && r.Status == "SELF_SUBMITTED" && r.ManagerId != null).ToListAsync(ct);
        var day = DateTime.UtcNow.ToString("yyyyMMdd");
        await uow.ExecuteAsync(async () =>
        {
            foreach (var r in pendingSelf)
                events.Publish(Topics.NotificationRequested, r.EmployeeId, new NotificationRequestedEvent(r.EmployeeId, null, "PERFORMANCE_REVIEW_REMINDER", "IN_APP", "Self evaluation pending",
                    $"Please complete your self evaluation for {c.Name} (due {c.SelfEvalDeadline:yyyy-MM-dd}).", null, "ReviewCycle", cycleId, $"perf-rem:{cycleId}:{r.EmployeeId}:{day}"));
            foreach (var r in pendingMgr)
                events.Publish(Topics.NotificationRequested, r.ManagerId!, new NotificationRequestedEvent(r.ManagerId, null, "PERFORMANCE_REVIEW_REMINDER", "IN_APP", "Manager evaluation pending",
                    $"Please evaluate {r.EmployeeName} for {c.Name} (due {c.ManagerEvalDeadline:yyyy-MM-dd}).", null, "ReviewCycle", cycleId, $"perf-rem-m:{cycleId}:{r.Id}:{day}"));
            await db.SaveChangesAsync(ct);
        }, ct);
        return new ReminderResultDto(pendingSelf.Count, pendingMgr.Count);
    }

    // ------------------------------------------------------------------ reads
    private bool CanView(PerformanceReview r) => r.EmployeeId == user.EmployeeId || r.ManagerId == user.EmployeeId || IsManage;

    public async Task<PagedResult<ReviewSummaryDto>> ListAsync(ReviewListQuery q, CancellationToken ct)
    {
        var query = db.PerformanceReviews.AsNoTracking().AsQueryable();
        if (!string.IsNullOrEmpty(q.CycleId)) query = query.Where(r => r.CycleId == q.CycleId);
        if (!string.IsNullOrEmpty(q.Status)) query = query.Where(r => r.Status == q.Status);
        var me = user.EmployeeId ?? "-";
        if (IsManage) { if (!string.IsNullOrEmpty(q.EmployeeId)) query = query.Where(r => r.EmployeeId == q.EmployeeId); }
        else if (!string.IsNullOrEmpty(q.EmployeeId) && q.EmployeeId != user.EmployeeId)
        {
            var mgr = await db.PerfEmployees.AsNoTracking().Where(e => e.EmployeeId == q.EmployeeId).Select(e => e.ManagerId).FirstOrDefaultAsync(ct);
            if (mgr != user.EmployeeId) throw new ForbiddenException();
            query = query.Where(r => r.EmployeeId == q.EmployeeId);
        }
        else if (user.HasPermission(Perm.PerformanceReview) && string.IsNullOrEmpty(q.EmployeeId)) query = query.Where(r => r.ManagerId == me);
        else query = query.Where(r => r.EmployeeId == me);
        if (!string.IsNullOrWhiteSpace(q.Search)) { var like = $"%{q.Search.Trim().EscapeLike()}%"; query = query.Where(r => EF.Functions.Like(r.EmployeeName!, like)); }
        query = query.OrderByAllowed(q.Sort, q.Descending, ["CreatedAt", "Status", "FinalRating", "EmployeeName"], "CreatedAt");
        return await query.ToPagedAsync(q, r => new ReviewSummaryDto(r.Id, r.CycleId, r.EmployeeId, r.EmployeeName, r.ManagerId, r.Status, r.SelfRating, r.ManagerRating, r.FinalRating, r.SelfSubmittedAt, r.ManagerSubmittedAt, r.ApprovedAt), ct);
    }

    public async Task<ReviewDetailDto> GetAsync(string id, CancellationToken ct)
    {
        var r = await db.PerformanceReviews.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Performance review not found");
        if (!CanView(r)) throw new ForbiddenException("You are not allowed to view this review");
        var questions = await db.FormQuestions.AsNoTracking().Where(q => q.FormId == r.FormId).OrderBy(q => q.OrderNo).ToListAsync(ct);
        var answers = await db.ReviewAnswers.AsNoTracking().Where(a => a.ReviewId == id).ToListAsync(ct);
        var history = await db.ReviewHistories.AsNoTracking().Where(h => h.ReviewId == id).OrderBy(h => h.CreatedAt).Select(h => new ReviewHistoryDto(h.Id, h.Action, h.Status, h.Comment, h.CreatedAt)).ToListAsync(ct);
        var cycle = await db.ReviewCycles.AsNoTracking().FirstOrDefaultAsync(c => c.Id == r.CycleId, ct);
        // an employee does not see the manager's answers/feedback/ratings until the review is approved
        var hide = r.EmployeeId == user.EmployeeId && r.Status != "APPROVED" && !IsManage;
        return new ReviewDetailDto(r.Id, r.CycleId, r.EmployeeId, r.EmployeeName, r.ManagerId, r.Status, r.SelfRating, hide ? null : r.ManagerRating, hide ? null : r.FinalRating,
            r.Achievements, r.Strengths, r.ImprovementAreas, hide ? null : r.ManagerFeedback, hide ? null : r.HrComment, r.ApprovedAt, cycle is null ? null : ToDto(cycle), questions.Select(ToDto).ToList(),
            answers.Where(a => !(hide && a.Respondent == "MANAGER")).Select(a => new AnswerDto(a.Id, a.QuestionId, a.Respondent, a.Rating, a.AnswerText)).ToList(), history);
    }

    public async Task<ReviewDetailDto?> MyCurrentAsync(CancellationToken ct)
    {
        var me = user.EmployeeId ?? "-";
        var id = await (from r in db.PerformanceReviews.AsNoTracking() join c in db.ReviewCycles on r.CycleId equals c.Id where r.EmployeeId == me && c.Status == "ACTIVE" orderby c.PeriodStart descending select r.Id).FirstOrDefaultAsync(ct);
        return id is null ? null : await GetAsync(id, ct);
    }

    // ------------------------------------------------------------------ evaluation
    private async Task SaveAnswerRowsAsync(PerformanceReview r, string respondent, List<AnswerRequest> answers, CancellationToken ct)
    {
        var qs = await db.FormQuestions.AsNoTracking().Where(q => q.FormId == r.FormId).ToDictionaryAsync(q => q.Id, ct);
        var existing = await db.ReviewAnswers.Where(a => a.ReviewId == r.Id && a.Respondent == respondent).ToListAsync(ct);
        foreach (var a in answers)
        {
            if (!qs.TryGetValue(a.QuestionId, out var q)) throw new Common.Common.ValidationException($"Question {a.QuestionId} is not part of this form");
            if (q.Type == "RATING" && a.Rating is null) throw new Common.Common.ValidationException($"A rating is required for \"{Short(q.Text)}\"");
            if (q.Type == "TEXT" && string.IsNullOrWhiteSpace(a.AnswerText)) throw new Common.Common.ValidationException($"An answer is required for \"{Short(q.Text)}\"");
            var row = existing.FirstOrDefault(x => x.QuestionId == a.QuestionId);
            if (row is null) db.ReviewAnswers.Add(new ReviewAnswer { ReviewId = r.Id, QuestionId = a.QuestionId, Respondent = respondent, Rating = a.Rating, AnswerText = a.AnswerText });
            else { row.Rating = a.Rating; row.AnswerText = a.AnswerText; }
        }
        await db.SaveChangesAsync(ct);
    }
    private static string Short(string s) => s.Length > 40 ? s[..40] : s;

    /// <summary>Weighted average of the RATING answers of one respondent (weights come from the form).</summary>
    private async Task<decimal?> WeightedAsync(string reviewId, string formId, string respondent, CancellationToken ct)
    {
        var qs = await db.FormQuestions.AsNoTracking().Where(q => q.FormId == formId && q.Type == "RATING").ToListAsync(ct);
        var ans = (await db.ReviewAnswers.AsNoTracking().Where(a => a.ReviewId == reviewId && a.Respondent == respondent && a.Rating != null).ToListAsync(ct)).ToDictionary(a => a.QuestionId, a => a.Rating!.Value);
        var scored = qs.Where(q => ans.ContainsKey(q.Id)).ToList();
        var den = scored.Sum(q => q.Weight);
        return den == 0 ? null : Math.Round(scored.Sum(q => ans[q.Id] * q.Weight) / den, 2);
    }

    private async Task AssertRequiredCompleteAsync(string reviewId, string formId, string respondent, CancellationToken ct)
    {
        var required = await db.FormQuestions.AsNoTracking().Where(q => q.FormId == formId && q.Required).ToListAsync(ct);
        var done = (await db.ReviewAnswers.AsNoTracking().Where(a => a.ReviewId == reviewId && a.Respondent == respondent).Select(a => a.QuestionId).ToListAsync(ct)).ToHashSet();
        var missing = required.Where(q => !done.Contains(q.Id)).ToList();
        if (missing.Count > 0) throw new Common.Common.ValidationException($"{missing.Count} required question(s) are unanswered", missing.Select(m => m.Id).ToList());
    }

    public async Task<ReviewDetailDto> SaveAnswersAsync(string id, string respondent, List<AnswerRequest> answers, CancellationToken ct)
    {
        var r = await db.PerformanceReviews.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Performance review not found");
        if (respondent == "SELF")
        {
            if (r.EmployeeId != user.EmployeeId) throw new ForbiddenException("Only the employee can fill the self evaluation");
            if (r.Status != "SELF_PENDING") throw new BusinessRuleException("The self evaluation has already been submitted");
        }
        else
        {
            AssertManager(r);
            if (r.Status != "SELF_SUBMITTED") throw new BusinessRuleException("The manager evaluation opens after the employee submits their self evaluation");
        }
        await uow.ExecuteAsync(() => SaveAnswerRowsAsync(r, respondent, answers, ct), ct);
        return await GetAsync(id, ct);
    }

    private void AssertManager(PerformanceReview r)
    {
        if (r.EmployeeId == user.EmployeeId) throw new ForbiddenException("You cannot evaluate yourself");
        if (r.ManagerId != user.EmployeeId && !IsManage) throw new ForbiddenException("Only the reporting manager can evaluate this review");
    }

    public async Task<ReviewDetailDto> SubmitSelfAsync(string id, SelfSubmitRequest req, CancellationToken ct)
    {
        var r = await db.PerformanceReviews.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Performance review not found");
        if (r.EmployeeId != user.EmployeeId) throw new ForbiddenException();
        if (r.Status != "SELF_PENDING") throw new BusinessRuleException("The self evaluation has already been submitted");
        var cycle = await db.ReviewCycles.AsNoTracking().FirstAsync(c => c.Id == r.CycleId, ct);
        if (cycle.Status != "ACTIVE") throw new BusinessRuleException("The review cycle is not active");
        if (DateOnly.FromDateTime(DateTime.UtcNow) > cycle.SelfEvalDeadline) throw new BusinessRuleException($"The self evaluation deadline ({cycle.SelfEvalDeadline:yyyy-MM-dd}) has passed");
        await uow.ExecuteAsync(async () =>
        {
            await AssertRequiredCompleteAsync(id, r.FormId, "SELF", ct);
            var rating = await WeightedAsync(id, r.FormId, "SELF", ct);
            r.Status = "SELF_SUBMITTED"; r.SelfRating = rating; r.SelfSubmittedAt = DateTime.UtcNow; r.Achievements = req.Achievements; r.Strengths = req.Strengths; r.ImprovementAreas = req.ImprovementAreas;
            db.ReviewHistories.Add(new ReviewHistory { ReviewId = id, Action = "SELF_SUBMITTED", Status = "SELF_SUBMITTED" });
            events.Publish(Topics.PerformanceReviewSubmitted, r.EmployeeId, new PerformanceReviewEvent(id, r.EmployeeId, r.ManagerId, r.CycleId, "SELF_SUBMITTED", rating));
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("PerformanceReview", id, "SELF_SUBMITTED", null, new { rating });
        }, ct);
        return await GetAsync(id, ct);
    }

    public async Task<ReviewDetailDto> SubmitManagerAsync(string id, ManagerSubmitRequest req, CancellationToken ct)
    {
        var r = await db.PerformanceReviews.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Performance review not found");
        AssertManager(r);
        if (r.Status != "SELF_SUBMITTED") throw new BusinessRuleException("Review is not awaiting a manager evaluation");
        await uow.ExecuteAsync(async () =>
        {
            await AssertRequiredCompleteAsync(id, r.FormId, "MANAGER", ct);
            var rating = await WeightedAsync(id, r.FormId, "MANAGER", ct);
            r.Status = "MANAGER_SUBMITTED"; r.ManagerRating = rating; r.ManagerFeedback = req.ManagerFeedback; r.ManagerSubmittedAt = DateTime.UtcNow;
            r.Strengths = req.Strengths ?? r.Strengths; r.ImprovementAreas = req.ImprovementAreas ?? r.ImprovementAreas;
            db.ReviewHistories.Add(new ReviewHistory { ReviewId = id, Action = "MANAGER_SUBMITTED", Status = "MANAGER_SUBMITTED" });
            events.Publish(Topics.PerformanceReviewSubmitted, r.EmployeeId, new PerformanceReviewEvent(id, r.EmployeeId, r.ManagerId, r.CycleId, "MANAGER_SUBMITTED", rating));
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("PerformanceReview", id, "MANAGER_SUBMITTED", null, new { rating });
        }, ct);
        return await GetAsync(id, ct);
    }

    public async Task<ReviewDetailDto> ApproveAsync(string id, ApproveReviewRequest req, CancellationToken ct)
    {
        var r = await db.PerformanceReviews.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Performance review not found");
        if (r.Status != "MANAGER_SUBMITTED") throw new BusinessRuleException("Only manager-submitted reviews can be approved");
        if (r.EmployeeId == user.EmployeeId) throw new ForbiddenException("You cannot approve your own review");
        var w = ManagerWeight;
        var computed = r.ManagerRating is { } m && r.SelfRating is { } s ? Math.Round(m * w + s * (1 - w), 2) : r.ManagerRating;
        var final = req.FinalRating ?? computed;
        await uow.ExecuteAsync(async () =>
        {
            r.Status = "APPROVED"; r.FinalRating = final; r.HrComment = req.HrComment; r.ApprovedAt = DateTime.UtcNow;
            db.ReviewHistories.Add(new ReviewHistory { ReviewId = id, Action = "APPROVED", Status = "APPROVED", Comment = req.HrComment });
            events.Publish(Topics.NotificationRequested, r.EmployeeId, new NotificationRequestedEvent(r.EmployeeId, null, "PERFORMANCE_REVIEW_APPROVED", "IN_APP", "Your performance review is finalised",
                "Your review has been approved. You can now view the outcome.", null, "PerformanceReview", id, null));
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("PerformanceReview", id, "APPROVED", new { computed }, new { finalRating = final });
        }, ct);
        return await GetAsync(id, ct);
    }

    // ------------------------------------------------------------------ reports
    public async Task<CycleReportDto> CycleReportAsync(string cycleId, CancellationToken ct)
    {
        var c = await db.ReviewCycles.AsNoTracking().FirstOrDefaultAsync(x => x.Id == cycleId, ct) ?? throw new NotFoundException("Review cycle not found");
        var reviews = await db.PerformanceReviews.AsNoTracking().Where(r => r.CycleId == cycleId).Select(r => new { r.EmployeeId, r.Status, r.SelfRating, r.ManagerRating, r.FinalRating }).ToListAsync(ct);
        var depts = await db.PerfEmployees.AsNoTracking().ToDictionaryAsync(e => e.EmployeeId, e => e.DepartmentId, ct);
        var byStatus = reviews.GroupBy(r => r.Status).Select(g => new StatusCountDto(g.Key, g.Count())).ToList();
        var byDept = reviews.GroupBy(r => depts.GetValueOrDefault(r.EmployeeId)).Select(g => new DepartmentRatingDto(g.Key, g.Count(), g.Where(x => x.FinalRating != null).Select(x => x.FinalRating).DefaultIfEmpty().Average())).ToList();
        var dist = reviews.Where(r => r.FinalRating != null).GroupBy(r => (int)Math.Floor(r.FinalRating!.Value)).OrderBy(g => g.Key).Select(g => new BucketDto(g.Key, g.Count())).ToList();
        decimal? Avg(IEnumerable<decimal?> xs) { var l = xs.Where(x => x != null).Select(x => x!.Value).ToList(); return l.Count == 0 ? null : Math.Round(l.Average(), 2); }
        return new CycleReportDto(ToDto(c), reviews.Count, byStatus, Avg(reviews.Select(r => r.SelfRating)), Avg(reviews.Select(r => r.ManagerRating)), Avg(reviews.Select(r => r.FinalRating)), byDept, dist);
    }

    public async Task<List<EmployeeReviewHistoryDto>> EmployeeHistoryAsync(string employeeId, CancellationToken ct)
    {
        if (employeeId != user.EmployeeId && !IsManage)
        {
            var mgr = await db.PerfEmployees.AsNoTracking().Where(e => e.EmployeeId == employeeId).Select(e => e.ManagerId).FirstOrDefaultAsync(ct);
            if (mgr != user.EmployeeId) throw new ForbiddenException();
        }
        var rows = await (from r in db.PerformanceReviews.AsNoTracking() join c in db.ReviewCycles on r.CycleId equals c.Id where r.EmployeeId == employeeId orderby c.PeriodStart descending
                          select new { r.Id, r.CycleId, c.Name, r.Status, r.SelfRating, r.ManagerRating, r.FinalRating, r.ApprovedAt }).ToListAsync(ct);
        var own = employeeId == user.EmployeeId && !IsManage;
        return rows.Select(r => new EmployeeReviewHistoryDto(r.Id, r.CycleId, r.Name, r.Status, r.SelfRating, own && r.Status != "APPROVED" ? null : r.ManagerRating, own && r.Status != "APPROVED" ? null : r.FinalRating, r.ApprovedAt)).ToList();
    }
}
