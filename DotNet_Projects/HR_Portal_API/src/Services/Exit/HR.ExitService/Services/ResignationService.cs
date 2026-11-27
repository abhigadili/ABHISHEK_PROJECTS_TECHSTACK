using HR.Common.Common;
using HR.Common.Data;
using HR.Common.Messaging;
using HR.Common.Security;
using HR.ExitService.Clients;
using HR.ExitService.Data;
using HR.ExitService.DTOs;
using HR.ExitService.Entities;
using Mapster;
using Microsoft.EntityFrameworkCore;

namespace HR.ExitService.Services;

public interface IResignationService
{
    Task<ResignationDetailDto> SubmitAsync(ResignRequest r, CancellationToken ct);
    Task<ResignationDetailDto> ManagerDecisionAsync(string id, bool approve, string? comment, CancellationToken ct);
    Task<ResignationDetailDto> HrConfirmAsync(string id, HrConfirmRequest r, CancellationToken ct);
    Task<ResignationDetailDto> WithdrawAsync(string id, string? reason, CancellationToken ct);
    Task<ResignationDetailDto> GetAsync(string id, CancellationToken ct);
    Task<ResignationDetailDto?> MineAsync(CancellationToken ct);
    Task<PagedResult<ResignationDto>> ListAsync(ResignationListQuery q, CancellationToken ct);
    Task<PolicyDto> GetPolicyAsync(CancellationToken ct);
    Task<PolicyDto> UpdatePolicyAsync(PolicyRequest r, CancellationToken ct);
    // used by the tasks / settlement services (same DbContext + transaction)
    Task<Resignation> LoadAsync(string id, CancellationToken ct);
    void Transition(Resignation r, string to, string? comment);
    Task AssertViewAsync(Resignation r, CancellationToken ct);
}

/// <summary>
/// Exit workflow (State pattern): SUBMITTED -> MANAGER_APPROVED -> HR_CONFIRMED -> CLEARED -> INTERVIEW_DONE -> SETTLEMENT_PENDING -> COMPLETED
/// (MANAGER_REJECTED / WITHDRAWN are terminal branches). Every transition is recorded in exit_history and the audit trail.
/// </summary>
public sealed class ResignationService(ExitDbContext db, ICurrentUser user, IEmployeeClient employees, IEventPublisher events, IAuditWriter audit, IUnitOfWork uow) : IResignationService
{
    private static readonly string[] ClearanceDepartments = ["MANAGER", "HR", "FINANCE", "IT", "ADMIN"];
    private static ResignationDto ToDto(Resignation r) => r.Adapt<ResignationDto>();
    private static TaskDto ToDto(ExitTask t) => new(t.Id, t.TaskType, t.Title, t.Department, t.DueDate, t.Status, t.CompletedAt, t.Remarks, t.AssetTag, t.SystemName, t.KtTopic, t.KtTransfereeId);
    private bool IsHrOrPayroll => user.HasAnyPermission(Perm.ExitManage, Perm.ExitApprove, Perm.PayrollProcess, Perm.PayrollView) || user.IsSuperAdmin;

    public async Task<Resignation> LoadAsync(string id, CancellationToken ct) => await db.Resignations.FirstOrDefaultAsync(r => r.Id == id, ct) ?? throw new NotFoundException("Resignation not found");

    public Task AssertViewAsync(Resignation r, CancellationToken ct)
    {
        if (r.EmployeeId == user.EmployeeId || r.ManagerId == user.EmployeeId || IsHrOrPayroll) return Task.CompletedTask;
        throw new ForbiddenException("You are not allowed to view this resignation");
    }

    public void Transition(Resignation r, string to, string? comment)
    {
        var from = r.Status;
        r.Status = to;
        db.ExitHistories.Add(new ExitHistory { ResignationId = r.Id, FromStatus = from, ToStatus = to, Comment = comment });
    }

    private async Task<ExitPolicy> PolicyAsync(CancellationToken ct) =>
        await db.ExitPolicies.AsNoTracking().OrderByDescending(p => p.CreatedAt).FirstOrDefaultAsync(ct) ?? new ExitPolicy { DefaultNoticeDays = 60, MaxWaiverDays = 30, SalaryDaysPerMonth = 30 };

    // ------------------------------------------------------------------ step 1: employee submits
    /// <summary>Notice period calculation: last working day = submitted + (notice - waiver); a shorter request needs a waiver within policy limits.</summary>
    public async Task<ResignationDetailDto> SubmitAsync(ResignRequest req, CancellationToken ct)
    {
        var me = user.EmployeeId ?? throw new ForbiddenException("Your account is not linked to an employee");
        var emp = await employees.SummaryAsync(me, ct);
        if (emp.Status != "ACTIVE") throw new BusinessRuleException("Only active employees can resign");
        if (await db.Resignations.AnyAsync(r => r.EmployeeId == me && r.Status != "MANAGER_REJECTED" && r.Status != "WITHDRAWN" && r.Status != "COMPLETED", ct)) throw new ConflictException("You already have an open resignation");
        var policy = await PolicyAsync(ct);
        var notice = emp.NoticePeriodDays > 0 ? emp.NoticePeriodDays : policy.DefaultNoticeDays;
        var today = DateOnly.FromDateTime(DateTime.UtcNow); var lwd = req.RequestedLastWorkingDay!.Value;
        if (lwd <= today) throw new Common.Common.ValidationException("The last working day must be after today");
        if (emp.JoiningDate is { } jd && lwd <= jd) throw new Common.Common.ValidationException("The last working day must be after the joining date");
        var required = today.AddDays(notice);
        var waiver = Math.Max(0, required.DayNumber - lwd.DayNumber);
        if (waiver > policy.MaxWaiverDays) throw new BusinessRuleException($"Requested date is {waiver} days short of the {notice}-day notice; the maximum waiver is {policy.MaxWaiverDays} days");
        var r = new Resignation { EmployeeId = me, EmployeeName = emp.FullName, ManagerId = emp.ManagerId, DepartmentId = emp.DepartmentId, JoiningDate = emp.JoiningDate, NoticePeriodDays = notice, Reason = req.Reason,
            RequestedLastWorkingDay = lwd, SubmittedOn = today, Status = "SUBMITTED", WaiverDays = waiver };
        await uow.ExecuteAsync(async () =>
        {
            db.Resignations.Add(r);
            await db.SaveChangesAsync(ct);
            db.ExitHistories.Add(new ExitHistory { ResignationId = r.Id, FromStatus = null, ToStatus = "SUBMITTED", Comment = req.Reason });
            events.Publish(Topics.ResignationSubmitted, me, new ResignationEvent(r.Id, me, emp.FullName, emp.ManagerId, lwd, "SUBMITTED"));
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("Resignation", r.Id, "SUBMITTED", null, new { requested = lwd, waiver });
        }, ct);
        return await GetAsync(r.Id, ct);
    }

    // ------------------------------------------------------------------ step 2: manager reviews
    public async Task<ResignationDetailDto> ManagerDecisionAsync(string id, bool approve, string? comment, CancellationToken ct)
    {
        var r = await LoadAsync(id, ct);
        if (r.Status != "SUBMITTED") throw new BusinessRuleException($"Resignation is {r.Status}");
        if (r.EmployeeId == user.EmployeeId) throw new ForbiddenException("You cannot review your own resignation");
        if (r.ManagerId != user.EmployeeId && !user.HasPermission(Perm.ExitManage) && !user.IsSuperAdmin) throw new ForbiddenException("Only the reporting manager can review");
        await uow.ExecuteAsync(async () =>
        {
            r.ManagerComment = comment;
            Transition(r, approve ? "MANAGER_APPROVED" : "MANAGER_REJECTED", comment);
            if (!approve) events.Publish(Topics.ResignationWithdrawn, r.EmployeeId, new ResignationEvent(id, r.EmployeeId, r.EmployeeName ?? "", r.ManagerId, r.RequestedLastWorkingDay, "MANAGER_REJECTED"));
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("Resignation", id, approve ? "STATUS_MANAGER_APPROVED" : "STATUS_MANAGER_REJECTED", null, new { comment });
        }, ct);
        return await GetAsync(id, ct);
    }

    // ------------------------------------------------------------------ step 3: HR confirms the last working day -> exit checklist
    public async Task<ResignationDetailDto> HrConfirmAsync(string id, HrConfirmRequest req, CancellationToken ct)
    {
        var r = await LoadAsync(id, ct);
        if (r.Status != "MANAGER_APPROVED") throw new BusinessRuleException("Resignation must be approved by the manager first");
        var policy = await PolicyAsync(ct);
        if (req.WaiverDays > policy.MaxWaiverDays) throw new BusinessRuleException($"Waiver cannot exceed {policy.MaxWaiverDays} days");
        var lwd = req.LastWorkingDay!.Value;
        var earliest = r.SubmittedOn.AddDays(r.NoticePeriodDays - req.WaiverDays);
        if (lwd < earliest) throw new BusinessRuleException($"Last working day cannot be before {earliest:yyyy-MM-dd} (notice {r.NoticePeriodDays} days minus waiver {req.WaiverDays})");
        await uow.ExecuteAsync(async () =>
        {
            r.ConfirmedLastWorkingDay = lwd; r.WaiverDays = req.WaiverDays; r.HrComment = req.Comment;
            Transition(r, "HR_CONFIRMED", req.Comment);
            ExitTask T(string type, string title, string? dept = null) => new() { ResignationId = id, TaskType = type, Title = title, Status = "PENDING", DueDate = lwd, Department = dept };
            db.ExitTasks.AddRange(T("CHECKLIST", "Hand over documents and complete the leaver form"), T("KT", "Knowledge transfer to the team"), T("ASSET", "Return company assets (laptop, access card)"), T("ACCESS", "Revoke system access"));
            db.ExitTasks.AddRange(ClearanceDepartments.Select(d => T("CLEARANCE", $"{d} clearance", d)));
            events.Publish(Topics.NotificationRequested, r.EmployeeId, new NotificationRequestedEvent(r.EmployeeId, null, "EXIT_LWD_CONFIRMED", "IN_APP", "Last working day confirmed",
                $"Your last working day is {lwd:yyyy-MM-dd}. Please complete your exit checklist.", null, "Resignation", id, null));
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("Resignation", id, "STATUS_HR_CONFIRMED", null, new { lastWorkingDay = lwd, req.WaiverDays });
        }, ct);
        return await GetAsync(id, ct);
    }

    public async Task<ResignationDetailDto> WithdrawAsync(string id, string? reason, CancellationToken ct)
    {
        var r = await LoadAsync(id, ct);
        if (r.EmployeeId != user.EmployeeId) throw new ForbiddenException("Only the employee can withdraw");
        var policy = await PolicyAsync(ct);
        var allowed = r.Status is "SUBMITTED" or "MANAGER_APPROVED" || (r.Status == "HR_CONFIRMED" && policy.WithdrawalAfterConfirmation);
        if (!allowed) throw new BusinessRuleException($"A resignation in status {r.Status} cannot be withdrawn");
        await uow.ExecuteAsync(async () =>
        {
            Transition(r, "WITHDRAWN", reason);
            db.ExitTasks.RemoveRange(await db.ExitTasks.Where(t => t.ResignationId == id && t.Status == "PENDING").ToListAsync(ct));
            events.Publish(Topics.ResignationWithdrawn, r.EmployeeId, new ResignationEvent(id, r.EmployeeId, r.EmployeeName ?? "", r.ManagerId, r.RequestedLastWorkingDay, "WITHDRAWN"));
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("Resignation", id, "STATUS_WITHDRAWN", null, new { reason });
        }, ct);
        return await GetAsync(id, ct);
    }

    // ------------------------------------------------------------------ reads
    public async Task<ResignationDetailDto> GetAsync(string id, CancellationToken ct)
    {
        var r = await db.Resignations.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Resignation not found");
        await AssertViewAsync(r, ct);
        var tasks = await db.ExitTasks.AsNoTracking().Where(t => t.ResignationId == id).OrderBy(t => t.TaskType).ThenBy(t => t.Title).ToListAsync(ct);
        var history = await db.ExitHistories.AsNoTracking().Where(h => h.ResignationId == id).OrderBy(h => h.CreatedAt).Select(h => new HistoryDto(h.Id, h.FromStatus, h.ToStatus, h.Comment, h.CreatedAt)).ToListAsync(ct);
        var iv = await db.ExitInterviews.AsNoTracking().FirstOrDefaultAsync(i => i.ResignationId == id, ct);
        var settlement = await SettlementViewAsync(id, ct);
        return new ResignationDetailDto(ToDto(r), r.SubmittedOn.AddDays(r.NoticePeriodDays - r.WaiverDays), new ProgressDto(tasks.Count(t => t.Status == "DONE"), tasks.Count), tasks.Select(ToDto).ToList(), history,
            iv is null ? null : new InterviewDto(iv.Id, iv.FormId, iv.ScheduledAt, iv.Status, iv.CompletedAt, iv.WouldRecommend, iv.FeedbackSummary, iv.Answers), settlement);
    }

    private async Task<SettlementDto?> SettlementViewAsync(string resignationId, CancellationToken ct)
    {
        if (!user.HasAnyPermission(Perm.ExitManage, Perm.PayrollProcess, Perm.PayrollView) && !user.IsSuperAdmin) return null;
        var s = await db.Settlements.AsNoTracking().FirstOrDefaultAsync(x => x.ResignationId == resignationId, ct);
        if (s is null) return null;
        var lines = await db.SettlementLines.AsNoTracking().Where(l => l.SettlementId == s.Id).OrderByDescending(l => l.Type).ThenBy(l => l.CreatedAt).Select(l => new SettlementLineDto(l.Id, l.Type, l.Code, l.Description, l.Amount)).ToListAsync(ct);
        return new SettlementDto(s.Id, s.ResignationId, s.EmployeeId, s.Status, s.GrossPayable, s.Recoveries, s.NetPayable, s.PaidAt, s.PaymentReference, null, null, lines);
    }

    public async Task<ResignationDetailDto?> MineAsync(CancellationToken ct)
    {
        var me = user.EmployeeId ?? "-";
        var id = await db.Resignations.AsNoTracking().Where(r => r.EmployeeId == me).OrderByDescending(r => r.CreatedAt).Select(r => r.Id).FirstOrDefaultAsync(ct);
        return id is null ? null : await GetAsync(id, ct);
    }

    public async Task<PagedResult<ResignationDto>> ListAsync(ResignationListQuery q, CancellationToken ct)
    {
        var query = db.Resignations.AsNoTracking().AsQueryable();
        if (!string.IsNullOrEmpty(q.Status)) query = query.Where(r => r.Status == q.Status);
        var me = user.EmployeeId ?? "-";
        if (user.HasAnyPermission(Perm.ExitManage, Perm.PayrollProcess) || user.IsSuperAdmin) { if (!string.IsNullOrEmpty(q.EmployeeId)) query = query.Where(r => r.EmployeeId == q.EmployeeId); }
        else if (user.HasPermission(Perm.ExitApprove)) query = query.Where(r => r.ManagerId == me);
        else query = query.Where(r => r.EmployeeId == me);
        if (!string.IsNullOrWhiteSpace(q.Search)) { var like = $"%{q.Search.Trim().EscapeLike()}%"; query = query.Where(r => EF.Functions.Like(r.EmployeeName!, like)); }
        query = query.OrderByAllowed(q.Sort, q.Descending, ["SubmittedOn", "Status", "CreatedAt", "ConfirmedLastWorkingDay"], "SubmittedOn");
        return await query.ToPagedAsync(q, r => new ResignationDto(r.Id, r.EmployeeId, r.EmployeeName, r.ManagerId, r.DepartmentId, r.JoiningDate, r.NoticePeriodDays, r.Reason, r.RequestedLastWorkingDay, r.SubmittedOn,
            r.ConfirmedLastWorkingDay, r.WaiverDays, r.Status, r.ManagerComment, r.HrComment, r.CompletedAt, r.Version), ct);
    }

    public async Task<PolicyDto> GetPolicyAsync(CancellationToken ct) { var p = await PolicyAsync(ct); return new PolicyDto(p.DefaultNoticeDays, p.MaxWaiverDays, p.SalaryDaysPerMonth, p.WithdrawalAfterConfirmation); }

    public async Task<PolicyDto> UpdatePolicyAsync(PolicyRequest r, CancellationToken ct)
    {
        var cur = await db.ExitPolicies.OrderByDescending(p => p.CreatedAt).FirstOrDefaultAsync(ct);
        if (cur is null) { cur = new ExitPolicy(); db.ExitPolicies.Add(cur); }
        cur.DefaultNoticeDays = r.DefaultNoticeDays; cur.MaxWaiverDays = r.MaxWaiverDays; cur.SalaryDaysPerMonth = r.SalaryDaysPerMonth; cur.WithdrawalAfterConfirmation = r.WithdrawalAfterConfirmation;
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync("ExitPolicy", "policy", "UPDATED", null, r);
        return await GetPolicyAsync(ct);
    }
}
