using HR.Common.Cache;
using HR.Common.Common;
using HR.Common.Data;
using HR.Common.Messaging;
using HR.Common.Security;
using HR.LeaveService.Data;
using HR.LeaveService.DTOs;
using HR.LeaveService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.LeaveService.Services;

public interface IBalanceService
{
    Task<List<BalanceDto>> ForEmployeeAsync(string employeeId, int year, CancellationToken ct);
    Task<List<BalanceDto>> ForEmployeeAuthorizedAsync(string employeeId, int year, CancellationToken ct);
    Task<List<Dictionary<string, object?>>> ReconcileAsync(string employeeId, int year, CancellationToken ct);
    Task<List<BalanceHistoryDto>> HistoryAsync(string employeeId, int? year, CancellationToken ct);
    Task<(LeaveBalance? Row, decimal Available)> LockAvailableAsync(string employeeId, string leaveTypeId, int year, CancellationToken ct);
    Task EvictAsync(string employeeId);
    Task<int> InitialiseAsync(string employeeId, DateOnly? joining, int year, CancellationToken ct);
    Task<RunResultDto> RunAccrualAsync(int year, int month, CancellationToken ct);
    Task<RunResultDto> CarryForwardAsync(int fromYear, CancellationToken ct);
    Task<List<BalanceDto>> AdjustAsync(AdjustBalanceRequest r, CancellationToken ct);
    Task<List<BalanceDto>> EncashAsync(EncashRequest r, CancellationToken ct);
}

public sealed class BalanceService(LeaveDbContext db, ICacheService cache, IRedisService redis, ICurrentUser user, IAdoNet ado, IAuditWriter audit, IEventPublisher events, IUnitOfWork uow) : IBalanceService
{
    private static decimal Available(LeaveBalance b) => b.Opening + b.Accrued + b.CarriedForward + b.Adjusted - b.Used - b.Pending - b.Encashed;

    private async Task<LeavePolicy?> DefaultPolicyAsync(CancellationToken ct) =>
        await db.LeavePolicies.AsNoTracking().Where(p => p.Active).OrderByDescending(p => p.IsDefault).ThenBy(p => p.CreatedAt).FirstOrDefaultAsync(ct);

    // ------------------------------------------------------------------ reads
    public async Task<List<BalanceDto>> ForEmployeeAsync(string employeeId, int year, CancellationToken ct) =>
        (await cache.GetOrCreateAsync(CacheKeys.LeaveBalance(employeeId, year), async c =>
            await (from b in db.LeaveBalances.AsNoTracking()
                   join t in db.LeaveTypes.IgnoreQueryFilters() on b.LeaveTypeId equals t.Id
                   where b.EmployeeId == employeeId && b.BalanceYear == year
                   orderby t.Code
                   select new BalanceDto(b.EmployeeId, b.LeaveTypeId, t.Code, t.Name, b.BalanceYear, b.Opening, b.Accrued, b.CarriedForward, b.Adjusted, b.Used, b.Pending, b.Encashed,
                       b.Opening + b.Accrued + b.CarriedForward + b.Adjusted, b.Opening + b.Accrued + b.CarriedForward + b.Adjusted - b.Used - b.Pending - b.Encashed, t.Paid, t.BalanceTracked)).ToListAsync(c),
            CacheKeys.Short, ct))!;

    /// <summary>Access control first (self, the manager of the employee, or HR) - only then the cached figures are served.</summary>
    public async Task<List<BalanceDto>> ForEmployeeAuthorizedAsync(string employeeId, int year, CancellationToken ct)
    {
        if (user.EmployeeId != employeeId && !user.IsSuperAdmin)
        {
            var manager = await db.LeaveEmployees.AsNoTracking().Where(e => e.EmployeeId == employeeId).Select(e => e.ManagerId).FirstOrDefaultAsync(ct);
            var allowed = user.HasPermission(Perm.LeavePolicyManage) || (user.HasAnyPermission(Perm.LeaveApprove, Perm.TeamView) && manager == user.EmployeeId);
            if (!allowed) throw new ForbiddenException("You may only view your own leave balance");
        }
        return await ForEmployeeAsync(employeeId, year, ct);
    }

    /// <summary>Same figures computed by the existing stored procedure (cross-check of recorded vs application-derived usage).</summary>
    public Task<List<Dictionary<string, object?>>> ReconcileAsync(string employeeId, int year, CancellationToken ct) =>
        ado.CallProcedureAsync("sp_calculate_leave_balance", r => r.ToDictionary(), new { p_employee_id = employeeId, p_year = year }, ct);

    public async Task<List<BalanceHistoryDto>> HistoryAsync(string employeeId, int? year, CancellationToken ct)
    {
        var q = from h in db.LeaveBalanceHistories.AsNoTracking()
                join t in db.LeaveTypes.IgnoreQueryFilters() on h.LeaveTypeId equals t.Id
                where h.EmployeeId == employeeId && (year == null || h.BalanceYear == year)
                orderby h.ChangedAt descending
                select new BalanceHistoryDto(h.Id, t.Code, h.BalanceYear, h.OldPending, h.NewPending, h.OldUsed, h.NewUsed, h.OldAccrued, h.NewAccrued, h.OldCarried, h.NewCarried, h.OldEncashed, h.NewEncashed, h.ChangedAt, h.ChangedBy);
        return await q.Take(300).ToListAsync(ct);
    }

    public Task EvictAsync(string employeeId) => cache.EvictPrefixAsync(CacheKeys.LeaveBalancePrefix(employeeId));

    /// <summary>Loads the balance row with a pessimistic lock (SELECT ... FOR UPDATE) so concurrent applications cannot overdraw it.</summary>
    public async Task<(LeaveBalance? Row, decimal Available)> LockAvailableAsync(string employeeId, string leaveTypeId, int year, CancellationToken ct)
    {
        var row = (await db.LeaveBalances.FromSqlInterpolated(
            $"SELECT * FROM leave_balances WHERE employee_id = {employeeId} AND leave_type_id = {leaveTypeId} AND balance_year = {year} FOR UPDATE").ToListAsync(ct)).FirstOrDefault();
        return (row, row is null ? 0 : Math.Round(Available(row), 2));
    }

    // ------------------------------------------------------------------ initialisation & accrual
    public async Task<int> InitialiseAsync(string employeeId, DateOnly? joining, int year, CancellationToken ct)
    {
        var policy = await DefaultPolicyAsync(ct);
        if (policy is null) return 0;
        var entitlements = await db.LeavePolicyEntitlements.AsNoTracking().Where(e => e.PolicyId == policy.Id).ToListAsync(ct);
        var existing = await db.LeaveBalances.Where(b => b.EmployeeId == employeeId && b.BalanceYear == year).Select(b => b.LeaveTypeId).ToListAsync(ct);
        var created = 0;
        foreach (var e in entitlements.Where(e => !existing.Contains(e.LeaveTypeId)))
        {
            var opening = e.AccrualPerMonth == 0 ? e.AnnualDays : 0;   // lump-sum entitlements (maternity, paternity ...)
            db.LeaveBalances.Add(new LeaveBalance
            {
                EmployeeId = employeeId, LeaveTypeId = e.LeaveTypeId, BalanceYear = year, Opening = opening,
                Accrued = e.AccrualPerMonth > 0 ? AccruedTo(e, joining, year, DateTime.UtcNow.Month) : 0
            });
            created++;
        }
        if (created > 0) await db.SaveChangesAsync(ct);
        await EvictAsync(employeeId);
        return created;
    }

    private static decimal AccruedTo(LeavePolicyEntitlement e, DateOnly? joining, int year, int month)
    {
        var startMonth = joining is { } j && j.Year == year ? j.Month : 1;
        var months = Math.Max(0, month - startMonth + 1);
        return Math.Round(Math.Min(e.AnnualDays, e.AccrualPerMonth * months), 2);
    }

    /// <summary>Monthly accrual: sets accrued to the target (idempotent). A Redis distributed lock + run log prevent concurrent/duplicate runs.</summary>
    public async Task<RunResultDto> RunAccrualAsync(int year, int month, CancellationToken ct)
    {
        var runKey = $"accrual:{year}-{month:D2}";
        await using var lease = await redis.TryLockAsync(runKey, TimeSpan.FromMinutes(2)) ?? throw new ConflictException("An accrual run for this month is already in progress");
        var policy = await DefaultPolicyAsync(ct) ?? throw new BusinessRuleException("No active leave policy configured");
        var ents = await db.LeavePolicyEntitlements.AsNoTracking().Where(e => e.PolicyId == policy.Id && e.AccrualPerMonth > 0).ToListAsync(ct);
        var emps = await db.LeaveEmployees.AsNoTracking().Where(e => e.Status == "ACTIVE" || e.Status == "ON_NOTICE").ToListAsync(ct);
        var processed = 0;
        foreach (var emp in emps)
        {
            await InitialiseAsync(emp.EmployeeId, emp.JoiningDate, year, ct);
            var rows = await db.LeaveBalances.Where(b => b.EmployeeId == emp.EmployeeId && b.BalanceYear == year).ToListAsync(ct);
            foreach (var e in ents)
            {
                var row = rows.FirstOrDefault(b => b.LeaveTypeId == e.LeaveTypeId);
                if (row is null) continue;
                var target = AccruedTo(e, emp.JoiningDate, year, month);
                if (row.Accrued != target) row.Accrued = target;
                processed++;
            }
            await db.SaveChangesAsync(ct);
            await EvictAsync(emp.EmployeeId);
        }
        var log = await db.LeaveRunLogs.FirstOrDefaultAsync(l => l.RunKey == runKey, ct);
        if (log is null) db.LeaveRunLogs.Add(new LeaveRunLog { RunKey = runKey, ExecutedAt = DateTime.UtcNow, ExecutedBy = user.UserId, RecordsProcessed = processed });
        else { log.ExecutedAt = DateTime.UtcNow; log.ExecutedBy = user.UserId; log.RecordsProcessed = processed; }
        await db.SaveChangesAsync(ct);
        return new RunResultDto(runKey, emps.Count, processed);
    }

    /// <summary>Year-end carry-forward limited by the policy's carry_forward_max; creates next-year balances. Runs once per year.</summary>
    public async Task<RunResultDto> CarryForwardAsync(int fromYear, CancellationToken ct)
    {
        var runKey = $"carry-forward:{fromYear}";
        if (await db.LeaveRunLogs.AnyAsync(l => l.RunKey == runKey, ct)) throw new ConflictException($"Carry-forward for {fromYear} has already been executed");
        var policy = await DefaultPolicyAsync(ct) ?? throw new BusinessRuleException("No active leave policy configured");
        var maxByType = await db.LeavePolicyEntitlements.AsNoTracking().Where(e => e.PolicyId == policy.Id).ToDictionaryAsync(e => e.LeaveTypeId, e => e.CarryForwardMax, ct);
        var emps = await db.LeaveEmployees.AsNoTracking().Where(e => e.Status == "ACTIVE" || e.Status == "ON_NOTICE").ToListAsync(ct);
        var records = 0;
        await uow.ExecuteAsync(async () =>
        {
            foreach (var emp in emps)
            {
                await InitialiseAsync(emp.EmployeeId, emp.JoiningDate, fromYear + 1, ct);
                var current = await db.LeaveBalances.AsNoTracking().Where(b => b.EmployeeId == emp.EmployeeId && b.BalanceYear == fromYear).ToListAsync(ct);
                var next = await db.LeaveBalances.Where(b => b.EmployeeId == emp.EmployeeId && b.BalanceYear == fromYear + 1).ToListAsync(ct);
                foreach (var b in current)
                {
                    var carry = Math.Min(Math.Max(0, Available(b)), maxByType.GetValueOrDefault(b.LeaveTypeId));
                    var target = next.FirstOrDefault(n => n.LeaveTypeId == b.LeaveTypeId);
                    if (carry > 0 && target is not null) { target.CarriedForward = carry; records++; }
                }
                await db.SaveChangesAsync(ct);
                await EvictAsync(emp.EmployeeId);
            }
            db.LeaveRunLogs.Add(new LeaveRunLog { RunKey = runKey, ExecutedAt = DateTime.UtcNow, ExecutedBy = user.UserId, RecordsProcessed = records });
            await db.SaveChangesAsync(ct);
        }, ct);
        return new RunResultDto(runKey, emps.Count, records);
    }

    // ------------------------------------------------------------------ manual adjustment & encashment
    public async Task<List<BalanceDto>> AdjustAsync(AdjustBalanceRequest r, CancellationToken ct)
    {
        await uow.ExecuteAsync(async () =>
        {
            var (row, available) = await LockAvailableAsync(r.EmployeeId, r.LeaveTypeId, r.Year, ct);
            if (row is null) throw new Common.Common.ValidationException("No balance row exists for that employee/leave type/year");
            if (available + r.Days < 0) throw new BusinessRuleException("Adjustment would make the balance negative");
            row.Adjusted += r.Days;
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("LeaveBalance", $"{r.EmployeeId}:{r.LeaveTypeId}:{r.Year}", "ADJUSTED", null, r);
        }, ct);
        await EvictAsync(r.EmployeeId);
        return await ForEmployeeAsync(r.EmployeeId, r.Year, ct);
    }

    public async Task<List<BalanceDto>> EncashAsync(EncashRequest r, CancellationToken ct)
    {
        var policy = await DefaultPolicyAsync(ct);
        var ent = policy is null ? null : await db.LeavePolicyEntitlements.AsNoTracking().FirstOrDefaultAsync(e => e.PolicyId == policy.Id && e.LeaveTypeId == r.LeaveTypeId, ct);
        if (ent is null || !ent.Encashable) throw new BusinessRuleException("This leave type is not encashable under the current policy");
        await uow.ExecuteAsync(async () =>
        {
            var (row, available) = await LockAvailableAsync(r.EmployeeId, r.LeaveTypeId, r.Year, ct);
            if (row is null) throw new Common.Common.ValidationException("No balance row exists for that employee/leave type/year");
            if (row.Encashed + r.Days > ent.EncashmentMaxDays) throw new BusinessRuleException($"Encashment limit of {ent.EncashmentMaxDays} days would be exceeded");
            if (r.Days > available) throw new BusinessRuleException("Insufficient available balance to encash");
            row.Encashed += r.Days;
            events.Publish(Topics.NotificationRequested, r.EmployeeId, new NotificationRequestedEvent(r.EmployeeId, null, "LEAVE_ENCASHED", "IN_APP", "Leave encashment recorded",
                $"{r.Days} day(s) of leave were encashed for {r.Year}. Payroll will include the payout.", null, "LeaveBalance", r.EmployeeId, null));
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("LeaveBalance", $"{r.EmployeeId}:{r.LeaveTypeId}:{r.Year}", "ENCASHED", null, r);
        }, ct);
        await EvictAsync(r.EmployeeId);
        return await ForEmployeeAsync(r.EmployeeId, r.Year, ct);
    }
}
