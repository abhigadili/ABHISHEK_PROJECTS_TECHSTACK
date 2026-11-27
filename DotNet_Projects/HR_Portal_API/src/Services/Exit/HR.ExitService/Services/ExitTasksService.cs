using System.Text.Json;
using HR.Common.Common;
using HR.Common.Data;
using HR.Common.Messaging;
using HR.Common.Security;
using HR.ExitService.Clients;
using HR.ExitService.Data;
using HR.ExitService.DTOs;
using HR.ExitService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.ExitService.Services;

public interface IExitTasksService
{
    Task<List<TaskDto>> ListAsync(string resignationId, CancellationToken ct);
    Task<TaskDto> AddTaskAsync(string resignationId, AddTaskRequest r, CancellationToken ct);
    Task<ResignationDetailDto> CompleteAsync(string resignationId, string taskId, CompleteTaskRequest r, CancellationToken ct);
    Task<List<InterviewFormDto>> ListFormsAsync(CancellationToken ct);
    Task<InterviewFormDto> CreateFormAsync(InterviewFormRequest r, CancellationToken ct);
    Task<InterviewFormDto> UpdateFormAsync(string id, InterviewFormUpdateRequest r, CancellationToken ct);
    Task<InterviewDto> ScheduleAsync(string resignationId, ScheduleInterviewRequest r, CancellationToken ct);
    Task<ResignationDetailDto> CompleteInterviewAsync(string resignationId, CompleteInterviewRequest r, CancellationToken ct);
}

public sealed class ExitTasksService(ExitDbContext db, IResignationService core, ICurrentUser user, IEventPublisher events, IAuditWriter audit, IUnitOfWork uow) : IExitTasksService
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static TaskDto ToDto(ExitTask t) => new(t.Id, t.TaskType, t.Title, t.Department, t.DueDate, t.Status, t.CompletedAt, t.Remarks, t.AssetTag, t.SystemName, t.KtTopic, t.KtTransfereeId);
    private bool IsExitManager => user.HasPermission(Perm.ExitManage) || user.IsSuperAdmin;
    private static InterviewFormDto ToDto(ExitInterviewForm f) => new(f.Id, f.Name, f.Active, JsonSerializer.Deserialize<List<InterviewQuestion>>(f.Questions, Json) ?? []);

    /// <summary>Who may close a task: the employee for checklist/KT; department owners for clearances; HR for everything.</summary>
    private bool CanComplete(Resignation r, ExitTask t)
    {
        if (IsExitManager) return true;
        if (t.TaskType == "CLEARANCE")
            return t.Department switch { "MANAGER" => r.ManagerId == user.EmployeeId && r.EmployeeId != user.EmployeeId, "FINANCE" => user.HasPermission(Perm.PayrollView), _ => false };
        return r.EmployeeId == user.EmployeeId && t.TaskType is "CHECKLIST" or "KT";
    }

    public async Task<List<TaskDto>> ListAsync(string resignationId, CancellationToken ct)
    {
        var r = await core.LoadAsync(resignationId, ct);
        await core.AssertViewAsync(r, ct);
        return (await db.ExitTasks.AsNoTracking().Where(t => t.ResignationId == resignationId).OrderBy(t => t.TaskType).ThenBy(t => t.Title).ToListAsync(ct)).Select(ToDto).ToList();
    }

    public async Task<TaskDto> AddTaskAsync(string resignationId, AddTaskRequest req, CancellationToken ct)
    {
        var r = await core.LoadAsync(resignationId, ct);
        if (!IsExitManager) throw new ForbiddenException();
        if (r.Status is not ("HR_CONFIRMED" or "CLEARED")) throw new BusinessRuleException("Tasks can only be added once the exit is confirmed and before the interview");
        var t = new ExitTask { ResignationId = resignationId, TaskType = req.TaskType, Title = req.Title, DueDate = req.DueDate ?? r.ConfirmedLastWorkingDay, Status = "PENDING", SystemName = req.SystemName, AssetTag = req.AssetTag, KtTopic = req.KtTopic };
        await uow.ExecuteAsync(async () =>
        {
            db.ExitTasks.Add(t);
            if (r.Status == "CLEARED") core.Transition(r, "HR_CONFIRMED", "New task added");
            await db.SaveChangesAsync(ct);
        }, ct);
        return ToDto(t);
    }

    public async Task<ResignationDetailDto> CompleteAsync(string resignationId, string taskId, CompleteTaskRequest req, CancellationToken ct)
    {
        var r = await core.LoadAsync(resignationId, ct);
        var t = await db.ExitTasks.FirstOrDefaultAsync(x => x.Id == taskId && x.ResignationId == resignationId, ct) ?? throw new NotFoundException("Task not found");
        if (r.Status != "HR_CONFIRMED") throw new BusinessRuleException($"Tasks can only be completed while the exit is HR_CONFIRMED (now {r.Status})");
        if (t.Status == "DONE") throw new BusinessRuleException("Task is already complete");
        if (!CanComplete(r, t)) throw new ForbiddenException("You cannot complete this task");
        if (t.TaskType == "ASSET" && (req.AssetTag ?? t.AssetTag) is null) throw new Common.Common.ValidationException("assetTag is required to confirm asset return");
        if (t.TaskType == "ACCESS" && (req.SystemName ?? t.SystemName) is null) throw new Common.Common.ValidationException("systemName is required to confirm access revocation");
        if (t.TaskType == "KT" && (req.KtTransfereeId ?? t.KtTransfereeId) is null) throw new Common.Common.ValidationException("ktTransfereeId (who receives the knowledge) is required");
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await uow.ExecuteAsync(async () =>
        {
            t.Status = "DONE"; t.CompletedAt = DateTime.UtcNow; t.CompletedBy = user.UserId; t.Remarks = req.Remarks;
            t.AssetTag = req.AssetTag ?? t.AssetTag; t.AssetCondition = req.AssetCondition ?? t.AssetCondition; if (t.TaskType == "ASSET") t.ReturnedOn = req.ReturnedOn ?? today;
            t.SystemName = req.SystemName ?? t.SystemName; if (t.TaskType == "ACCESS") t.RevokedOn = req.RevokedOn ?? today;
            t.KtTopic = req.KtTopic ?? t.KtTopic; t.KtTransfereeId = req.KtTransfereeId ?? t.KtTransfereeId;
            await db.SaveChangesAsync(ct);
            var open = await db.ExitTasks.CountAsync(x => x.ResignationId == resignationId && x.Status == "PENDING", ct);
            if (open == 0) core.Transition(r, "CLEARED", "All exit tasks and clearances completed");
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("ExitTask", taskId, "COMPLETED", null, new { type = t.TaskType, department = t.Department });
        }, ct);
        return await core.GetAsync(resignationId, ct);
    }

    // ------------------------------------------------------------------ exit interview (configurable forms)
    public async Task<List<InterviewFormDto>> ListFormsAsync(CancellationToken ct) => (await db.ExitInterviewForms.AsNoTracking().Where(f => f.Active).OrderBy(f => f.Name).ToListAsync(ct)).Select(ToDto).ToList();

    public async Task<InterviewFormDto> CreateFormAsync(InterviewFormRequest r, CancellationToken ct)
    {
        var f = new ExitInterviewForm { Name = r.Name, Active = r.Active, Questions = JsonSerializer.Serialize(r.Questions, Json) };
        db.ExitInterviewForms.Add(f);
        await db.SaveChangesAsync(ct);
        return ToDto(f);
    }

    public async Task<InterviewFormDto> UpdateFormAsync(string id, InterviewFormUpdateRequest r, CancellationToken ct)
    {
        var f = await db.ExitInterviewForms.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Exit interview form not found");
        f.Name = r.Name ?? f.Name; if (r.Active is { } a) f.Active = a; if (r.Questions is not null) f.Questions = JsonSerializer.Serialize(r.Questions, Json);
        await db.SaveChangesAsync(ct);
        return ToDto(f);
    }

    public async Task<InterviewDto> ScheduleAsync(string resignationId, ScheduleInterviewRequest req, CancellationToken ct)
    {
        var r = await core.LoadAsync(resignationId, ct);
        if (r.Status is not ("HR_CONFIRMED" or "CLEARED")) throw new BusinessRuleException("Interviews are scheduled after HR confirmation");
        if (await db.ExitInterviews.AnyAsync(i => i.ResignationId == resignationId, ct)) throw new BusinessRuleException("An exit interview already exists for this resignation");
        var form = req.FormId is not null ? await db.ExitInterviewForms.FirstOrDefaultAsync(f => f.Id == req.FormId, ct) : await db.ExitInterviewForms.FirstOrDefaultAsync(f => f.Active, ct);
        if (form is null) throw new BusinessRuleException("No exit interview form is configured");
        var when = req.ScheduledAt!.Value.ToUniversalTime();
        var iv = new ExitInterview { ResignationId = resignationId, FormId = form.Id, ScheduledAt = when, Status = "SCHEDULED", ConductedBy = user.UserId };
        await uow.ExecuteAsync(async () =>
        {
            db.ExitInterviews.Add(iv);
            events.Publish(Topics.NotificationRequested, r.EmployeeId, new NotificationRequestedEvent(r.EmployeeId, null, "EXIT_INTERVIEW_SCHEDULED", "IN_APP", "Exit interview scheduled", $"Your exit interview is on {when:u}.", null, "Resignation", resignationId, null));
            await db.SaveChangesAsync(ct);
        }, ct);
        return new InterviewDto(iv.Id, iv.FormId, iv.ScheduledAt, iv.Status, null, null, null, null);
    }

    public async Task<ResignationDetailDto> CompleteInterviewAsync(string resignationId, CompleteInterviewRequest req, CancellationToken ct)
    {
        var r = await core.LoadAsync(resignationId, ct);
        if (!IsExitManager) throw new ForbiddenException("Only HR conducts exit interviews");
        if (r.Status != "CLEARED") throw new BusinessRuleException("The exit interview is completed after all clearances (status CLEARED)");
        var iv = await db.ExitInterviews.FirstOrDefaultAsync(i => i.ResignationId == resignationId, ct) ?? throw new BusinessRuleException("Schedule the exit interview first");
        var form = await db.ExitInterviewForms.AsNoTracking().FirstAsync(f => f.Id == iv.FormId, ct);
        var questions = JsonSerializer.Deserialize<List<InterviewQuestion>>(form.Questions, Json) ?? [];
        var byQ = req.Answers.ToDictionary(a => a.QuestionId, a => a.Answer);
        foreach (var q in questions)
        {
            byQ.TryGetValue(q.Id, out var a);
            var present = a.ValueKind != JsonValueKind.Undefined && !(a.ValueKind == JsonValueKind.String && string.IsNullOrEmpty(a.GetString()));
            if (q.Required && !present) throw new Common.Common.ValidationException($"Question \"{Short(q.Text)}\" is required");
            if (present && q.Type == "RATING" && !(a.ValueKind == JsonValueKind.Number && a.TryGetInt32(out var n) && n is >= 1 and <= 5)) throw new Common.Common.ValidationException($"Question \"{Short(q.Text)}\" needs a rating 1-5");
        }
        foreach (var id in byQ.Keys) if (questions.All(q => q.Id != id)) throw new Common.Common.ValidationException($"Unknown question {id}");
        await uow.ExecuteAsync(async () =>
        {
            iv.Answers = JsonSerializer.Serialize(req.Answers.Select(a => new { questionId = a.QuestionId, answer = a.Answer }), Json);
            iv.WouldRecommend = req.WouldRecommend; iv.FeedbackSummary = req.FeedbackSummary; iv.Status = "COMPLETED"; iv.CompletedAt = DateTime.UtcNow; iv.ConductedBy = user.UserId;
            core.Transition(r, "INTERVIEW_DONE", "Exit interview completed");
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("ExitInterview", iv.Id, "COMPLETED");
        }, ct);
        return await core.GetAsync(resignationId, ct);
    }

    private static string Short(string s) => s.Length > 40 ? s[..40] : s;
}
