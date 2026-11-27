using System.Runtime.CompilerServices;
using HR.Common.Cache;
using HR.Common.Common;
using HR.Common.Messaging;
using HR.Common.Security;
using HR.ReportingService.Clients;
using HR.ReportingService.Data;
using HR.ReportingService.DTOs;
using HR.ReportingService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.ReportingService.Services;

public interface IReportingService
{
    Task<HeadcountReportDto> HeadcountAsync(PeriodQuery q, CancellationToken ct);
    Task<LeaveReportDto> LeaveAsync(PeriodQuery q, CancellationToken ct);
    Task<AttendanceReportDto> AttendanceAsync(string? month, CancellationToken ct);
    Task<object> PayrollAsync(string? month, CancellationToken ct);
    Task<TaxReportDto> TaxAsync(string? fy, CancellationToken ct);
    Task<ProjectReportDto> ProjectsAsync(string? status, CancellationToken ct);
    Task<TimesheetReportDto> TimesheetsAsync(PeriodQuery q, CancellationToken ct);
    Task<PerformanceReportDto> PerformanceAsync(string? cycleId, CancellationToken ct);
    Task<ExitReportDto> ExitsAsync(PeriodQuery q, CancellationToken ct);
    Task<SummaryDto> SummaryAsync(CancellationToken ct);
    Task<(IAsyncEnumerable<string> Lines, string FileName)> ExportAsync(string report, CancellationToken ct);
    Task RecordFactAsync(string type, string subjectKey, string? category, string? status, string? period, DateOnly? dateA, DateOnly? dateB, string? employeeId, decimal? a, decimal? b, decimal? c, DateTime occurredAt, CancellationToken ct);
}

public sealed class ReportingService(ReportingDbContext db, ICurrentUser user, ICacheService cache, IPayrollApi payroll, IProjectApi projectApi, IPerformanceApi performanceApi, IConfiguration cfg) : IReportingService
{
    private TimeSpan Ttl => TimeSpan.FromSeconds(cfg.GetValue("Reporting:CacheSeconds", 120));
    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    /// <summary>Managers only see their own team; HR / finance / admins see everyone.</summary>
    private async Task<List<string>?> ScopeAsync(CancellationToken ct)
    {
        if (user.HasAnyPermission(Perm.EmployeeWrite, Perm.PayrollView, Perm.AuditView) || user.IsSuperAdmin) return null;
        var me = user.EmployeeId ?? throw new ForbiddenException();
        return await db.RptEmployees.AsNoTracking().Where(e => e.ManagerId == me).Select(e => e.EmployeeId).ToListAsync(ct);
    }

    private Task<T?> CachedAsync<T>(string name, object parameters, Func<CancellationToken, Task<T?>> loader, CancellationToken ct) where T : class =>
        cache.GetOrCreateAsync($"rpt:{name}:{user.EmployeeId ?? user.UserId}:{System.Text.Json.JsonSerializer.Serialize(parameters)}", loader, Ttl, ct);

    // ------------------------------------------------------------------ headcount (LINQ: group, join-free projections, set operations)
    public async Task<HeadcountReportDto> HeadcountAsync(PeriodQuery q, CancellationToken ct)
    {
        var ids = await ScopeAsync(ct);
        var from = q.From ?? Today.AddDays(-365); var to = q.To ?? Today;
        return (await CachedAsync("headcount", new { q.From, q.To, q.DepartmentId, scoped = ids is not null }, async c =>
        {
            var byDept = await db.VwHeadcountByDepartments.AsNoTracking().Where(v => q.DepartmentId == null || v.DepartmentId == q.DepartmentId).ToListAsync(c);
            var joiners = await db.RptEmployees.AsNoTracking().Where(e => e.JoiningDate >= from && e.JoiningDate <= to && (q.DepartmentId == null || e.DepartmentId == q.DepartmentId))
                .Select(e => new MovementDto(e.EmployeeId, e.FullName, e.DepartmentId, e.JoiningDate!.Value)).ToListAsync(c);
            var leavers = await db.RptEmployees.AsNoTracking().Where(e => e.ExitDate != null && e.ExitDate >= from && e.ExitDate <= to && (q.DepartmentId == null || e.DepartmentId == q.DepartmentId))
                .Select(e => new MovementDto(e.EmployeeId, e.FullName, e.DepartmentId, e.ExitDate!.Value)).ToListAsync(c);
            var rows = ids is null ? byDept.Select(v => new DepartmentHeadcountDto(v.DepartmentId, v.Status, v.Employees)).ToList() : [];
            var active = ids?.Count ?? rows.Where(r => r.Status is "ACTIVE" or "ON_NOTICE").Sum(r => r.Employees);
            return new HeadcountReportDto(from, to, ids is null ? "ORGANIZATION" : "TEAM", ids?.Count, active, rows,
                ids is null ? joiners : joiners.Where(j => ids.Contains(j.EmployeeId)).ToList(), ids is null ? leavers : leavers.Where(j => ids.Contains(j.EmployeeId)).ToList());
        }, ct))!;
    }

    // ------------------------------------------------------------------ leave
    public async Task<LeaveReportDto> LeaveAsync(PeriodQuery q, CancellationToken ct)
    {
        var ids = await ScopeAsync(ct);
        var from = q.From ?? new DateOnly(Today.Year, 1, 1); var to = q.To ?? new DateOnly(Today.Year, 12, 31);
        return (await CachedAsync("leave", new { q.From, q.To, q.DepartmentId, scoped = ids is not null }, async c =>
        {
            var facts = await db.RptFacts.AsNoTracking().Where(f => f.FactType == "LEAVE" && f.DateA >= from && f.DateA <= to).Select(f => new { f.EmployeeId, f.Category, f.Status, f.NumA }).ToListAsync(c);
            var dept = await db.RptEmployees.AsNoTracking().ToDictionaryAsync(e => e.EmployeeId, e => e.DepartmentId, c);
            var scoped = facts.Where(f => (ids is null || (f.EmployeeId != null && ids.Contains(f.EmployeeId))) && (q.DepartmentId is null || (f.EmployeeId != null && dept.GetValueOrDefault(f.EmployeeId) == q.DepartmentId))).ToList();
            // CPU-bound grouping of potentially large fact sets runs as two parallel PLINQ aggregations
            var byType = Task.Run(() => scoped.AsParallel().GroupBy(f => (Key: f.Category ?? "UNKNOWN", f.Status)).Select(g => new GroupTotalDto(g.Key.Key, g.Key.Status ?? "", g.Count(), g.Sum(x => x.NumA ?? 0))).OrderBy(g => g.Key).ThenBy(g => g.Status).ToList(), c);
            var byDept = Task.Run(() => scoped.AsParallel().GroupBy(f => (Key: f.EmployeeId is null ? "UNASSIGNED" : dept.GetValueOrDefault(f.EmployeeId) ?? "UNASSIGNED", f.Status)).Select(g => new GroupTotalDto(g.Key.Key, g.Key.Status ?? "", g.Count(), g.Sum(x => x.NumA ?? 0))).OrderBy(g => g.Key).ToList(), c);
            await Task.WhenAll(byType, byDept);
            var util = ids is null ? await db.VwLeaveUtilizations.AsNoTracking().OrderByDescending(v => v.Month).ThenBy(v => v.LeaveType).Select(v => new UtilizationDto(v.Month, v.LeaveType, v.Status, v.Applications, v.Days)).ToListAsync(c) : [];
            return new LeaveReportDto(from, to, scoped.Count, byType.Result, byDept.Result, util);
        }, ct))!;
    }

    // ------------------------------------------------------------------ attendance / tax / timesheets / performance / exits (facts maintained from Kafka events)
    public async Task<AttendanceReportDto> AttendanceAsync(string? month, CancellationToken ct)
    {
        await ScopeAsync(ct);
        var m = month ?? Today.ToString("yyyy-MM"); var first = DateOnly.ParseExact(m + "-01", "yyyy-MM-dd"); var last = first.AddMonths(1).AddDays(-1);
        return (await CachedAsync("attendance", m, async c =>
        {
            var rows = await db.RptFacts.AsNoTracking().Where(f => f.FactType == "ATTENDANCE" && f.PeriodKey == m && f.DateA != null).Select(f => new { f.DateA, f.Status, f.NumA }).ToListAsync(c);
            var daily = rows.GroupBy(r => r.DateA!.Value).OrderBy(g => g.Key).Select(g => new DailyAttendanceDto(g.Key, g.Count(x => x.Status == "CHECKED_IN"), g.Count(x => x.Status == "CHECKED_OUT"), g.Count(x => x.Status == "CORRECTED"),
                g.Where(x => x.NumA is > 0).Select(x => x.NumA!.Value).DefaultIfEmpty().Average())).ToList();
            return new AttendanceReportDto(m, first, last, daily);
        }, ct))!;
    }

    /// <summary>Payroll comes from the Payroll Service API (it owns the data); only callers with payroll access get numbers.</summary>
    public async Task<object> PayrollAsync(string? month, CancellationToken ct)
    {
        if (!user.HasPermission(Perm.PayrollView) && !user.IsSuperAdmin) throw new ForbiddenException("Payroll reports require payroll access");
        var m = month ?? Today.ToString("yyyy-MM");
        var runs = await payroll.RunsAsync(m, ct);
        var details = await Task.WhenAll(runs.Select(async r => { try { return await payroll.RunReportAsync(r.Id, ct); } catch (HrException) { return null; } }));
        return new { month = m, runs = runs.Select((r, i) => new { r.Id, r.Status, r.EmployeeCount, r.TotalGross, r.TotalDeductions, r.TotalNet, report = details[i] }) };
    }

    public async Task<TaxReportDto> TaxAsync(string? fy, CancellationToken ct)
    {
        if (!user.HasAnyPermission(Perm.TaxReview, Perm.PayrollView, Perm.AuditView) && !user.IsSuperAdmin) throw new ForbiddenException();
        var f = fy ?? Engine.FinancialYear(Today);
        var rows = await db.RptFacts.AsNoTracking().Where(x => x.FactType == "TAX" && x.PeriodKey == f).GroupBy(x => new { x.Status, x.Category })
            .Select(g => new TaxStatusDto(g.Key.Status, g.Key.Category, g.Count(), g.Sum(x => x.NumA ?? 0))).ToListAsync(ct);
        return new TaxReportDto(f, rows);
    }

    public async Task<TimesheetReportDto> TimesheetsAsync(PeriodQuery q, CancellationToken ct)
    {
        await ScopeAsync(ct);
        var from = q.From ?? Today.AddDays(-28); var to = q.To ?? Today;
        var rows = await db.RptFacts.AsNoTracking().Where(f => f.FactType == "TIMESHEET" && f.DateA >= from && f.DateA <= to).GroupBy(f => f.Status).Select(g => new TimesheetStatusDto(g.Key, g.Count(), g.Sum(x => x.NumA ?? 0))).ToListAsync(ct);
        return new TimesheetReportDto(from, to, rows);
    }

    public async Task<PerformanceReportDto> PerformanceAsync(string? cycleId, CancellationToken ct)
    {
        if (!user.HasAnyPermission(Perm.PerformanceManage, Perm.ReportView) && !user.IsSuperAdmin) throw new ForbiddenException();
        var subs = await db.RptFacts.AsNoTracking().Where(f => f.FactType == "REVIEW").GroupBy(f => f.Category).Select(g => new PerformanceSubmissionDto(g.Key, g.Count())).ToListAsync(ct);
        object? cycle = null;
        if (cycleId is not null) { try { cycle = await performanceApi.CycleReportAsync(cycleId, ct); } catch (HrException) { } }
        return new PerformanceReportDto(subs, cycle);
    }

    public async Task<ExitReportDto> ExitsAsync(PeriodQuery q, CancellationToken ct)
    {
        var ids = await ScopeAsync(ct);
        var from = q.From ?? Today.AddDays(-365); var to = q.To ?? Today.AddDays(365);
        var rows = await db.RptFacts.AsNoTracking().Where(f => f.FactType == "EXIT" && f.DateA >= from && f.DateA <= to).Select(f => new ExitFactDto(f.SubjectKey, f.Status, f.EmployeeId, f.PeriodKey, f.DateA)).ToListAsync(ct);
        if (ids is not null) rows = rows.Where(r => r.EmployeeId != null && ids.Contains(r.EmployeeId)).ToList();
        var leavers = await db.RptEmployees.AsNoTracking().Where(e => e.ExitDate != null && e.ExitDate >= from && e.ExitDate <= to).Select(e => new MovementDto(e.EmployeeId, e.FullName, e.DepartmentId, e.ExitDate!.Value)).ToListAsync(ct);
        return new ExitReportDto(from, to, rows, [], leavers);
    }

    /// <summary>Executive summary: every section runs independently and a failing section never fails the whole report.</summary>
    public async Task<SummaryDto> SummaryAsync(CancellationToken ct)
    {
        var unavailable = new List<string>();
        async Task<T?> Section<T>(string name, Func<Task<T>> f) where T : class { try { return await f(); } catch (Exception ex) when (ex is not OperationCanceledException) { unavailable.Add(name); return null; } }
        var empty = new PeriodQuery();
        // sections share one scoped DbContext, so they run sequentially (the context is not thread-safe)
        var h = await Section("headcount", () => HeadcountAsync(empty, ct));
        var l = await Section("leave", () => LeaveAsync(empty, ct));
        var a = await Section("attendance", () => AttendanceAsync(null, ct));
        var t = await Section("timesheets", () => TimesheetsAsync(empty, ct));
        var e = await Section("exits", () => ExitsAsync(empty, ct));
        return new SummaryDto(h, l, a, t, e, unavailable);
    }

    /// <summary>Allocation report: projects and their teams are fetched concurrently from the Project Service (bounded), then grouped per employee.</summary>
    public async Task<ProjectReportDto> ProjectsAsync(string? status, CancellationToken ct)
    {
        if (!user.HasAnyPermission(Perm.ProjectManage, Perm.ReportView) && !user.IsSuperAdmin) throw new ForbiddenException();
        var list = (await projectApi.ListAsync(status, ct)).Take(50).ToList();
        using var gate = new SemaphoreSlim(8);   // at most 8 concurrent calls
        var details = await Task.WhenAll(list.Select(async p =>
        {
            await gate.WaitAsync(ct);
            try { return await projectApi.GetAsync(p.Id, ct); } catch (HrException) { return null; } finally { gate.Release(); }
        }));
        var ok = details.Where(d => d is not null).Select(d => d!).ToList();
        var projects = ok.Select(d => (object)new { d.Project.Id, d.Project.Code, d.Project.Name, d.Project.Status, team = d.Team.Where(t => t.Status == "ACTIVE") }).ToList();
        var loads = ok.SelectMany(d => d.Team.Where(t => t.Status == "ACTIVE").Select(t => (t.EmployeeId, t.EmployeeName, t.AllocationPercent, d.Project.Code))).GroupBy(x => x.EmployeeId)
            .Select(g => new AllocationLoadDto(g.Key, g.First().EmployeeName, g.Sum(x => x.AllocationPercent), g.Select(x => x.Code).ToList())).OrderByDescending(l => l.TotalAllocation).ToList();
        return new ProjectReportDto(projects, loads, loads.Where(l => l.TotalAllocation > 100).ToList());
    }

    // ------------------------------------------------------------------ CSV export: streamed row by row (IAsyncEnumerable), memory stays flat for any row count
    public async Task<(IAsyncEnumerable<string> Lines, string FileName)> ExportAsync(string report, CancellationToken ct)
    {
        if (!user.HasAnyPermission(Perm.EmployeeWrite, Perm.AuditView, Perm.ReportView) && !user.IsSuperAdmin) throw new ForbiddenException();
        var ids = await ScopeAsync(ct);
        IAsyncEnumerable<string[]> rows = report switch
        {
            "employees" => EmployeeRows(ids, ct),
            "leave" => FactRows("LEAVE", ids, ct),
            "exits" => FactRows("EXIT", ids, ct),
            _ => throw new NotFoundException("Unknown report")
        };
        return (ToCsv(rows, ct), $"{report}-{Today:yyyy-MM-dd}.csv");
    }

    private async IAsyncEnumerable<string[]> EmployeeRows(List<string>? ids, [EnumeratorCancellation] CancellationToken ct)
    {
        yield return ["employee_id", "employee_code", "full_name", "department_id", "designation_id", "location_id", "manager_id", "status", "joining_date", "exit_date"];
        await foreach (var e in db.RptEmployees.AsNoTracking().OrderBy(e => e.EmployeeCode).AsAsyncEnumerable().WithCancellation(ct))
        {
            if (ids is not null && !ids.Contains(e.EmployeeId)) continue;
            yield return [e.EmployeeId, e.EmployeeCode ?? "", e.FullName ?? "", e.DepartmentId ?? "", e.DesignationId ?? "", e.LocationId ?? "", e.ManagerId ?? "", e.Status, e.JoiningDate?.ToString("yyyy-MM-dd") ?? "", e.ExitDate?.ToString("yyyy-MM-dd") ?? ""];
        }
    }

    private async IAsyncEnumerable<string[]> FactRows(string type, List<string>? ids, [EnumeratorCancellation] CancellationToken ct)
    {
        yield return ["subject_key", "employee_id", "category", "status", "period", "date_a", "date_b", "num_a"];
        await foreach (var f in db.RptFacts.AsNoTracking().Where(f => f.FactType == type).OrderBy(f => f.OccurredAt).AsAsyncEnumerable().WithCancellation(ct))
        {
            if (ids is not null && f.EmployeeId is not null && !ids.Contains(f.EmployeeId)) continue;
            yield return [f.SubjectKey, f.EmployeeId ?? "", f.Category ?? "", f.Status ?? "", f.PeriodKey ?? "", f.DateA?.ToString("yyyy-MM-dd") ?? "", f.DateB?.ToString("yyyy-MM-dd") ?? "", f.NumA?.ToString(System.Globalization.CultureInfo.InvariantCulture) ?? ""];
        }
    }

    private static async IAsyncEnumerable<string> ToCsv(IAsyncEnumerable<string[]> rows, [EnumeratorCancellation] CancellationToken ct)
    {
        await foreach (var r in rows.WithCancellation(ct)) yield return string.Join(',', r.Select(EscapeCsv)) + "\n";
    }

    /// <summary>CSV-injection safe: cells starting with = + - @ are prefixed with a quote.</summary>
    private static string EscapeCsv(string v)
    {
        if (v.Length > 0 && "=+-@".Contains(v[0])) v = "'" + v;
        return v.IndexOfAny(['"', ',', '\n']) >= 0 ? "\"" + v.Replace("\"", "\"\"") + "\"" : v;
    }

    // ------------------------------------------------------------------ fact upsert (one row per (fact_type, subject_key))
    public async Task RecordFactAsync(string type, string subjectKey, string? category, string? status, string? period, DateOnly? dateA, DateOnly? dateB, string? employeeId, decimal? a, decimal? b, decimal? c, DateTime occurredAt, CancellationToken ct)
    {
        var f = await db.RptFacts.FirstOrDefaultAsync(x => x.FactType == type && x.SubjectKey == subjectKey, ct);
        if (f is null) { f = new RptFact { FactType = type, SubjectKey = subjectKey }; db.RptFacts.Add(f); }
        f.Category = category; f.Status = status; f.PeriodKey = period; f.DateA = dateA; f.DateB = dateB; f.EmployeeId = employeeId; f.NumA = a; f.NumB = b; f.NumC = c; f.OccurredAt = occurredAt;
        await db.SaveChangesAsync(ct);
    }

    private static class Engine { public static string FinancialYear(DateOnly d) { var s = d.Month >= 4 ? d.Year : d.Year - 1; return $"{s}-{(s + 1) % 100:D2}"; } }
}
