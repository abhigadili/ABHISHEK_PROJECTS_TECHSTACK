using HR.Common.Common;
using HR.Common.Data;
using HR.Common.Messaging;
using HR.Common.Security;
using HR.PerformanceService.Data;
using HR.PerformanceService.DTOs;
using HR.PerformanceService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.PerformanceService.Services;

public interface IGoalService
{
    Task<List<GoalDto>> ListAsync(GoalListQuery q, CancellationToken ct);
    Task<GoalDto> CreateAsync(GoalRequest r, CancellationToken ct);
    Task<GoalDto> UpdateAsync(string id, GoalUpdateRequest r, CancellationToken ct);
    Task DeleteAsync(string id, CancellationToken ct);
    Task<KeyResultDto> AddKeyResultAsync(string goalId, KeyResultRequest r, CancellationToken ct);
    Task<KeyResultDto> UpdateKeyResultAsync(string goalId, string krId, KeyResultUpdateRequest r, CancellationToken ct);
    Task<FeedbackDto> GiveFeedbackAsync(FeedbackRequest r, CancellationToken ct);
    Task<List<FeedbackDto>> FeedbackForAsync(string employeeId, CancellationToken ct);
}

public sealed class GoalService(PerformanceDbContext db, ICurrentUser user, IAuditWriter audit) : IGoalService
{
    private static KeyResultDto ToDto(KeyResult k) => new(k.Id, k.GoalId, k.Description, k.TargetValue, k.CurrentValue, k.Unit);
    private static GoalDto ToDto(Goal g, IEnumerable<KeyResult> krs) => new(g.Id, g.EmployeeId, g.Title, g.Description, g.Type, g.CycleId, g.TargetDate, g.Weight, g.Progress, g.Status, krs.Select(ToDto).ToList());
    private bool IsManage => user.HasPermission(Perm.PerformanceManage) || user.IsSuperAdmin;

    private async Task CanSeeAsync(string employeeId, CancellationToken ct)
    {
        if (employeeId == user.EmployeeId || IsManage) return;
        var mgr = await db.PerfEmployees.AsNoTracking().Where(e => e.EmployeeId == employeeId).Select(e => e.ManagerId).FirstOrDefaultAsync(ct);
        if (mgr != user.EmployeeId) throw new ForbiddenException("You may only view your own or your reports' goals");
    }

    public async Task<List<GoalDto>> ListAsync(GoalListQuery q, CancellationToken ct)
    {
        var employeeId = q.EmployeeId ?? user.EmployeeId ?? throw new ForbiddenException("Your account is not linked to an employee");
        await CanSeeAsync(employeeId, ct);
        var goals = await db.Goals.AsNoTracking().Where(g => g.EmployeeId == employeeId && (q.CycleId == null || g.CycleId == q.CycleId)).OrderByDescending(g => g.CreatedAt).ToListAsync(ct);
        var ids = goals.Select(g => g.Id).ToList();
        var krs = (await db.KeyResults.AsNoTracking().Where(k => ids.Contains(k.GoalId)).ToListAsync(ct)).ToLookup(k => k.GoalId);
        return goals.Select(g => ToDto(g, krs[g.Id])).ToList();
    }

    private async Task AssertWeightAsync(string employeeId, string? cycleId, int add, string? excludeId, CancellationToken ct)
    {
        var ex = excludeId ?? "";
        var used = await db.Goals.Where(g => g.EmployeeId == employeeId && g.Status != "CANCELLED" && g.CycleId == cycleId && g.Id != ex).SumAsync(g => (int?)g.Weight, ct) ?? 0;
        if (used + add > 100) throw new BusinessRuleException($"Goal weights for this cycle would total {used + add}% (max 100%)");
    }

    public async Task<GoalDto> CreateAsync(GoalRequest r, CancellationToken ct)
    {
        var me = user.EmployeeId ?? throw new ForbiddenException("Your account is not linked to an employee");
        await AssertWeightAsync(me, r.CycleId, r.Weight, null, ct);
        var g = new Goal { EmployeeId = me, Title = r.Title, Description = r.Description, Type = r.Type, CycleId = r.CycleId, TargetDate = r.TargetDate, Weight = r.Weight, Status = "NOT_STARTED", Progress = 0 };
        db.Goals.Add(g);
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync("Goal", g.Id, "CREATED", null, new { r.Title });
        return ToDto(g, []);
    }

    private async Task<Goal> OwnAsync(string id, CancellationToken ct)
    {
        var g = await db.Goals.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Goal not found");
        if (g.EmployeeId != user.EmployeeId && !IsManage)
        {
            var mgr = await db.PerfEmployees.AsNoTracking().Where(e => e.EmployeeId == g.EmployeeId).Select(e => e.ManagerId).FirstOrDefaultAsync(ct);
            if (mgr != user.EmployeeId) throw new ForbiddenException();
        }
        return g;
    }

    public async Task<GoalDto> UpdateAsync(string id, GoalUpdateRequest r, CancellationToken ct)
    {
        var g = await OwnAsync(id, ct);
        if (r.Weight is { } w) await AssertWeightAsync(g.EmployeeId, g.CycleId, w, id, ct);
        g.Title = r.Title ?? g.Title; g.Description = r.Description ?? g.Description; g.Type = r.Type ?? g.Type; g.CycleId = r.CycleId ?? g.CycleId; g.TargetDate = r.TargetDate ?? g.TargetDate;
        g.Weight = r.Weight ?? g.Weight; g.Progress = r.Progress ?? g.Progress;
        if (r.Status is not null) g.Status = r.Status;
        else if (r.Progress == 100) g.Status = "COMPLETED";
        else if (r.Progress > 0 && g.Status == "NOT_STARTED") g.Status = "IN_PROGRESS";
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync("Goal", id, "UPDATED", null, r);
        return ToDto(g, await db.KeyResults.AsNoTracking().Where(k => k.GoalId == id).ToListAsync(ct));
    }

    public async Task DeleteAsync(string id, CancellationToken ct)
    {
        var g = await OwnAsync(id, ct);
        g.Deleted = true; g.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    public async Task<KeyResultDto> AddKeyResultAsync(string goalId, KeyResultRequest r, CancellationToken ct)
    {
        var g = await OwnAsync(goalId, ct);
        if (g.Type != "OKR") throw new BusinessRuleException("Key results apply to OKR goals only");
        var kr = new KeyResult { GoalId = goalId, Description = r.Description, TargetValue = r.TargetValue, CurrentValue = r.CurrentValue, Unit = r.Unit };
        db.KeyResults.Add(kr);
        await db.SaveChangesAsync(ct);
        await RollupAsync(g, ct);
        return ToDto(kr);
    }

    public async Task<KeyResultDto> UpdateKeyResultAsync(string goalId, string krId, KeyResultUpdateRequest r, CancellationToken ct)
    {
        var g = await OwnAsync(goalId, ct);
        var kr = await db.KeyResults.FirstOrDefaultAsync(k => k.Id == krId && k.GoalId == goalId, ct) ?? throw new NotFoundException("Key result not found");
        kr.CurrentValue = r.CurrentValue; kr.Description = r.Description ?? kr.Description; kr.TargetValue = r.TargetValue ?? kr.TargetValue;
        await db.SaveChangesAsync(ct);
        await RollupAsync(g, ct);
        return ToDto(kr);
    }

    /// <summary>OKR progress = average attainment of its key results (each capped at 100%).</summary>
    private async Task RollupAsync(Goal g, CancellationToken ct)
    {
        var krs = await db.KeyResults.AsNoTracking().Where(k => k.GoalId == g.Id).ToListAsync(ct);
        if (krs.Count == 0) return;
        var pct = (int)Math.Min(100, Math.Round(krs.Average(k => Math.Min(1m, k.CurrentValue / k.TargetValue)) * 100, MidpointRounding.AwayFromZero));
        g.Progress = pct; g.Status = pct >= 100 ? "COMPLETED" : pct > 0 ? "IN_PROGRESS" : "NOT_STARTED";
        await db.SaveChangesAsync(ct);
    }

    public async Task<FeedbackDto> GiveFeedbackAsync(FeedbackRequest r, CancellationToken ct)
    {
        var me = user.EmployeeId ?? throw new ForbiddenException("Your account is not linked to an employee");
        if (r.ToEmployeeId == me) throw new Common.Common.ValidationException("You cannot give feedback to yourself");
        var target = await db.PerfEmployees.AsNoTracking().FirstOrDefaultAsync(e => e.EmployeeId == r.ToEmployeeId, ct) ?? throw new NotFoundException("Employee not found");
        if (r.Type == "MANAGER" && target.ManagerId != me) throw new ForbiddenException("Manager feedback can only be given to your direct reports");
        var f = new Feedback { FromEmployeeId = me, ToEmployeeId = r.ToEmployeeId, Type = r.Type, Comment = r.Comment, Rating = r.Rating, ReviewId = r.ReviewId };
        db.Feedbacks.Add(f);
        await db.SaveChangesAsync(ct);
        return new FeedbackDto(f.Id, f.FromEmployeeId, f.ToEmployeeId, f.Type, f.Comment, f.Rating, f.ReviewId, f.CreatedAt);
    }

    public async Task<List<FeedbackDto>> FeedbackForAsync(string employeeId, CancellationToken ct)
    {
        await CanSeeAsync(employeeId, ct);
        var rows = await db.Feedbacks.AsNoTracking().Where(f => f.ToEmployeeId == employeeId).OrderByDescending(f => f.CreatedAt).ToListAsync(ct);
        // peer feedback is shown to its subject without the author's identity
        return rows.Select(f => new FeedbackDto(f.Id, f.Type == "PEER" && employeeId == user.EmployeeId ? null : f.FromEmployeeId, f.ToEmployeeId, f.Type, f.Comment, f.Rating, f.ReviewId, f.CreatedAt)).ToList();
    }
}

public sealed class PerfEmployeeReadModel(PerformanceDbContext db) : IEmployeeReadModel
{
    public async Task UpsertAsync(EmployeeEvent e, CancellationToken ct)
    {
        var row = await db.PerfEmployees.FirstOrDefaultAsync(x => x.EmployeeId == e.EmployeeId, ct);
        if (row is null) { row = new PerfEmployee { EmployeeId = e.EmployeeId }; db.PerfEmployees.Add(row); }
        row.DepartmentId = e.DepartmentId; row.FullName = e.FullName; row.ManagerId = e.ManagerId; row.Status = e.Status;
        await db.SaveChangesAsync(ct);
    }
}
