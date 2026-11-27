using HR.Common.Cache;
using HR.Common.Common;
using HR.Common.Data;
using HR.Common.Messaging;
using HR.Common.Security;
using HR.PayrollService.Clients;
using HR.PayrollService.Data;
using HR.PayrollService.DTOs;
using HR.PayrollService.Engine;
using HR.PayrollService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.PayrollService.Services;

public interface IPayrollRunService
{
    Task<RunDto> CreateAsync(CreateRunRequest r, CancellationToken ct);
    Task<PagedResult<RunDto>> ListAsync(RunListQuery q, CancellationToken ct);
    Task<RunDetailDto> GetAsync(string id, CancellationToken ct);
    Task<PagedResult<EntryDto>> EntriesAsync(string runId, EntryListQuery q, CancellationToken ct);
    Task<EntryDetailDto> EntryAsync(string runId, string entryId, CancellationToken ct);
    Task<CalculationResultDto> CalculateAsync(string runId, CancellationToken ct);
    Task<RunDetailDto> ProcessAsync(string runId, CancellationToken ct);
    Task<RunDetailDto> ApproveAsync(string runId, CancellationToken ct);
    Task<RunDetailDto> FinalizeAsync(string runId, CancellationToken ct);
    Task<RunReportDto> ReportAsync(string runId, CancellationToken ct);
    Task<int> GeneratePayslipsAsync(string runId, CancellationToken ct);
    Task<List<EmployeePayrollHistoryDto>> EmployeeHistoryAsync(string employeeId, CancellationToken ct);
}

public sealed class PayrollRunService(PayrollDbContext db, ISalaryService salary, ISalaryEngine engine, IPayslipService payslips, IEmployeeClient employees, IAttendanceClient attendance,
    ILeaveClient leave, ITaxClient tax, IRedisService redis, IAdoNet ado, ICurrentUser user, IEventPublisher events, IAuditWriter audit, IUnitOfWork uow, IConfiguration cfg, ILogger<PayrollRunService> log) : IPayrollRunService
{
    private static RunDto ToDto(PayrollRun r) => new(r.Id, r.PayrollMonth, r.Status, r.Note, r.EmployeeCount, r.TotalGross, r.TotalDeductions, r.TotalNet, r.ProcessedBy, r.ProcessedAt, r.ApprovedBy, r.ApprovedAt, r.FinalizedBy, r.FinalizedAt, r.Version);
    private static EntryDto ToDto(PayrollEntry e) => new(e.Id, e.RunId, e.PayrollMonth, e.EmployeeId, e.EmployeeCode, e.EmployeeName, e.DepartmentId, e.WorkingDays, e.PaidDays, e.LopDays, e.OvertimeMinutes, e.Gross, e.Deductions, e.Net);
    private int BatchSize => cfg.GetValue("Payroll:BatchSize", 10);

    public async Task<RunDto> CreateAsync(CreateRunRequest r, CancellationToken ct)
    {
        if (await db.PayrollRuns.AnyAsync(x => x.PayrollMonth == r.Month, ct)) throw new ConflictException($"A payroll run for {r.Month} already exists");
        var run = new PayrollRun { PayrollMonth = r.Month, Status = "DRAFT", Note = r.Note };
        db.PayrollRuns.Add(run);
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync("PayrollRun", run.Id, "CREATED", null, new { r.Month });
        return ToDto(run);
    }

    public async Task<PagedResult<RunDto>> ListAsync(RunListQuery q, CancellationToken ct)
    {
        var query = db.PayrollRuns.AsNoTracking().AsQueryable();
        if (!string.IsNullOrEmpty(q.Status)) query = query.Where(r => r.Status == q.Status);
        query = query.OrderByAllowed(q.Sort ?? "PayrollMonth", q.Sort is null || q.Descending, ["PayrollMonth", "Status", "TotalNet"], "PayrollMonth");
        return await query.ToPagedAsync(q, r => new RunDto(r.Id, r.PayrollMonth, r.Status, r.Note, r.EmployeeCount, r.TotalGross, r.TotalDeductions, r.TotalNet, r.ProcessedBy, r.ProcessedAt, r.ApprovedBy, r.ApprovedAt, r.FinalizedBy, r.FinalizedAt, r.Version), ct);
    }

    private async Task<List<DepartmentTotalDto>> ByDepartmentAsync(string runId, CancellationToken ct) =>
        await db.PayrollEntries.AsNoTracking().Where(e => e.RunId == runId).GroupBy(e => e.DepartmentId)
            .Select(g => new DepartmentTotalDto(g.Key, g.Count(), g.Sum(x => x.Gross), g.Sum(x => x.Deductions), g.Sum(x => x.Net))).ToListAsync(ct);

    public async Task<RunDetailDto> GetAsync(string id, CancellationToken ct)
    {
        var run = await db.PayrollRuns.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id, ct) ?? throw new NotFoundException("Payroll run not found");
        return new RunDetailDto(ToDto(run), await ByDepartmentAsync(id, ct));
    }

    public async Task<PagedResult<EntryDto>> EntriesAsync(string runId, EntryListQuery q, CancellationToken ct)
    {
        if (!await db.PayrollRuns.AnyAsync(r => r.Id == runId, ct)) throw new NotFoundException("Payroll run not found");
        var query = db.PayrollEntries.AsNoTracking().Where(e => e.RunId == runId);
        if (!string.IsNullOrEmpty(q.DepartmentId)) query = query.Where(e => e.DepartmentId == q.DepartmentId);
        if (!string.IsNullOrEmpty(q.EmployeeId)) query = query.Where(e => e.EmployeeId == q.EmployeeId);
        if (!string.IsNullOrWhiteSpace(q.Search)) { var like = $"%{q.Search.Trim().EscapeLike()}%"; query = query.Where(e => EF.Functions.Like(e.EmployeeName!, like) || EF.Functions.Like(e.EmployeeCode!, like)); }
        query = query.OrderByAllowed(q.Sort, q.Descending, ["EmployeeName", "EmployeeCode", "Gross", "Net"], "EmployeeName");
        return await query.ToPagedAsync(q, e => new EntryDto(e.Id, e.RunId, e.PayrollMonth, e.EmployeeId, e.EmployeeCode, e.EmployeeName, e.DepartmentId, e.WorkingDays, e.PaidDays, e.LopDays, e.OvertimeMinutes, e.Gross, e.Deductions, e.Net), ct);
    }

    public async Task<EntryDetailDto> EntryAsync(string runId, string entryId, CancellationToken ct)
    {
        var e = await db.PayrollEntries.AsNoTracking().FirstOrDefaultAsync(x => x.Id == entryId && x.RunId == runId, ct) ?? throw new Common.Common.ValidationException("Entry does not belong to this run");
        var lines = await db.PayrollEntryLines.AsNoTracking().Where(l => l.EntryId == entryId).OrderBy(l => l.Type).ThenBy(l => l.ComponentCode).Select(l => new EntryLineDto(l.ComponentCode, l.ComponentName, l.Type, l.Amount, l.Note)).ToListAsync(ct);
        return new EntryDetailDto(ToDto(e), lines);
    }

    // ------------------------------------------------------------------ calculation
    private sealed record EmployeeInputs(DirectoryEntry Emp, EmployeeSalary Salary, List<StructureComponentInfo> Components, List<PayrollAdjustment> Adjustments, List<Loan> Loans);
    private sealed record Plan(DirectoryEntry Emp, EmployeeSalary Salary, List<Line> Lines, AttendanceFacts Facts, List<(string LoanId, decimal Amount)> Loans);

    /// <summary>DB-bound inputs are read sequentially on the request's DbContext (not thread-safe).</summary>
    private async Task<EmployeeInputs?> LoadInputsAsync(DirectoryEntry emp, string month, CancellationToken ct)
    {
        var first = DateOnly.ParseExact(month + "-01", "yyyy-MM-dd"); var last = first.AddMonths(1).AddDays(-1);
        var sal = await db.EmployeeSalaries.AsNoTracking().Where(s => s.EmployeeId == emp.EmployeeId && s.Status != "SUPERSEDED" && s.EffectiveFrom <= last && (s.EffectiveTo == null || s.EffectiveTo >= first))
            .OrderByDescending(s => s.EffectiveFrom).FirstOrDefaultAsync(ct)
            ?? await db.EmployeeSalaries.AsNoTracking().Where(s => s.EmployeeId == emp.EmployeeId && s.EffectiveFrom <= last && (s.EffectiveTo == null || s.EffectiveTo >= first)).OrderByDescending(s => s.EffectiveFrom).FirstOrDefaultAsync(ct);
        if (sal is null) return null;
        var comps = await (from sc in db.SalaryStructureComponents.AsNoTracking() join c in db.SalaryComponents.IgnoreQueryFilters() on sc.ComponentId equals c.Id
                           where sc.StructureId == sal.StructureId && c.Active
                           select new StructureComponentInfo(c.Code, c.Name, c.Type == "EARNING" ? LineType.EARNING : LineType.DEDUCTION, c.CalcType, sc.Value, c.DisplayOrder)).ToListAsync(ct);
        var adj = await db.PayrollAdjustments.AsNoTracking().Where(a => a.EmployeeId == emp.EmployeeId && a.PayrollMonth == month && a.Status == "PENDING").ToListAsync(ct);
        var loans = await db.Loans.AsNoTracking().Where(l => l.EmployeeId == emp.EmployeeId && l.Status == "ACTIVE" && l.Outstanding > 0 && string.Compare(l.StartMonth, month) <= 0).ToListAsync(ct);
        return new EmployeeInputs(emp, sal, comps, adj, loans);
    }

    public async Task<CalculationResultDto> CalculateAsync(string runId, CancellationToken ct)
    {
        var run = await db.PayrollRuns.FirstOrDefaultAsync(r => r.Id == runId, ct) ?? throw new NotFoundException("Payroll run not found");
        if (run.Status != "DRAFT") throw new BusinessRuleException("Only DRAFT runs can be calculated");
        await using var lease = await redis.TryLockAsync($"payroll-calc:{runId}", TimeSpan.FromMinutes(5)) ?? throw new ConflictException("This run is already being calculated");
        var settings = PayrollSettingsParser.Parse(await salary.SettingsAsync(ct));
        var all = await employees.ActiveEmployeesAsync(ct);
        var plans = new List<Plan>(); var skipped = new List<SkippedDto>();

        for (var i = 0; i < all.Count; i += BatchSize)
        {
            var batch = all.Skip(i).Take(BatchSize).ToList();
            var inputs = new List<EmployeeInputs>();
            foreach (var e in batch)
            {
                var inp = await LoadInputsAsync(e, run.PayrollMonth, ct);
                if (inp is null) skipped.Add(new SkippedDto(e.EmployeeId, "no active salary")); else inputs.Add(inp);
            }
            // remote calls for the whole batch run concurrently (I/O-bound), one Task.WhenAll per batch
            var remote = await Task.WhenAll(inputs.Select(async inp =>
            {
                try
                {
                    var tAtt = attendance.PayrollInputAsync(inp.Emp.EmployeeId, run.PayrollMonth, ct);
                    var tLeave = Safe(() => leave.MonthlyAsync(inp.Emp.EmployeeId, run.PayrollMonth, ct), new LeaveMonthly(0, 0));
                    var tTds = Safe(() => tax.MonthlyTdsAsync(inp.Emp.EmployeeId, run.PayrollMonth, ct), 0m);
                    await Task.WhenAll(tAtt, tLeave, tTds);
                    return (inp, att: tAtt.Result, lv: tLeave.Result, tds: tTds.Result, error: (string?)null);
                }
                catch (Exception ex) when (ex is HrException) { return (inp, att: (AttendanceInput?)null, lv: new LeaveMonthly(0, 0), tds: 0m, error: ex.Message); }
            }));
            foreach (var (inp, att, lv, tds, error) in remote)
            {
                if (att is null) { skipped.Add(new SkippedDto(inp.Emp.EmployeeId, (error ?? "attendance unavailable")[..Math.Min(120, (error ?? "attendance unavailable").Length)])); log.LogWarning("Payroll plan failed for {Employee}: {Error}", inp.Emp.EmployeeId, error); continue; }
                plans.Add(await BuildPlanAsync(inp, att, lv, tds, settings, ct));
            }
        }

        await uow.ExecuteAsync(async () =>
        {
            var oldEntries = await db.PayrollEntries.Where(e => e.RunId == runId).Select(e => e.Id).ToListAsync(ct);
            if (oldEntries.Count > 0)
            {
                await db.PayrollEntryLines.Where(l => oldEntries.Contains(l.EntryId)).ExecuteDeleteAsync(ct);
                await db.LoanDeductions.Where(d => d.RunId == runId).ExecuteDeleteAsync(ct);
                await db.PayrollEntries.Where(e => e.RunId == runId).ExecuteDeleteAsync(ct);
            }
            foreach (var p in plans)
            {
                var t = engine.Totals(p.Lines);
                var entry = new PayrollEntry
                {
                    RunId = runId, PayrollMonth = run.PayrollMonth, EmployeeId = p.Emp.EmployeeId, EmployeeCode = p.Emp.EmployeeCode, EmployeeName = p.Emp.FullName, DepartmentId = p.Emp.DepartmentId, SalaryId = p.Salary.Id,
                    WorkingDays = p.Facts.WorkingDays, PaidDays = p.Facts.PaidDays, LopDays = p.Facts.LopDays, OvertimeMinutes = p.Facts.OvertimeMinutes, Gross = t.Gross, Deductions = t.Deductions, Net = t.Net
                };
                db.PayrollEntries.Add(entry);
                foreach (var l in p.Lines) db.PayrollEntryLines.Add(new PayrollEntryLine { EntryId = entry.Id, ComponentCode = l.Code, ComponentName = l.Name, Type = l.Type.ToString(), Amount = l.Amount, Note = l.Note });
                foreach (var ln in p.Loans) db.LoanDeductions.Add(new LoanDeduction { RunId = runId, EmployeeId = p.Emp.EmployeeId, LoanId = ln.LoanId, Amount = ln.Amount });
            }
            run.EmployeeCount = plans.Count;
            run.Note = skipped.Count > 0 ? $"{skipped.Count} employee(s) skipped" : run.Note;
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("PayrollRun", runId, "CALCULATED", null, new { employees = plans.Count, skipped = skipped.Count });
        }, ct);
        return new CalculationResultDto(runId, plans.Count, skipped);
    }

    private static async Task<T> Safe<T>(Func<Task<T>> f, T fallback) { try { return await f(); } catch (HrException) { return fallback; } }

    private async Task<Plan> BuildPlanAsync(EmployeeInputs inp, AttendanceInput att, LeaveMonthly lv, decimal tds, PayrollSettings settings, CancellationToken ct)
    {
        var workingDays = att.WorkingDays;
        var lop = Math.Min(workingDays, att.AbsentDays + att.HalfDays * 0.5m + lv.UnpaidLeaveDays);
        var paid = Math.Max(0, workingDays - lop);
        var monthlyCtc = inp.Salary.AnnualCtc / 12;
        var basicPct = inp.Components.FirstOrDefault(c => c.Code == "BASIC")?.Value ?? 0;
        var hourly = workingDays > 0 ? monthlyCtc * basicPct / 100 / (workingDays * settings.StandardHoursPerDay) : 0;
        var overtimePay = att.OvertimeMinutes > 0 ? await OvertimePayAsync(att.OvertimeMinutes, hourly, settings.OvertimeMultiplier, ct) : 0;
        var loans = inp.Loans.Select(l => (l.Id, Math.Min(l.Emi, l.Outstanding))).ToList();
        var lines = engine.Calculate(new EngineInput(monthlyCtc, inp.Components, settings, new AttendanceFacts(workingDays, paid, lop, att.OvertimeMinutes), overtimePay, tds,
            inp.Adjustments.Select(a => new AdjustmentInfo(a.Type, a.Amount, a.Description)).ToList(), loans.Sum(l => l.Item2)));
        return new Plan(inp.Emp, inp.Salary, lines, new AttendanceFacts(workingDays, paid, lop, att.OvertimeMinutes), loans);
    }

    /// <summary>Overtime pay from the existing MySQL function fn_overtime_pay (executed once per employee with overtime).</summary>
    private async Task<decimal> OvertimePayAsync(int minutes, decimal hourly, decimal multiplier, CancellationToken ct) =>
        await ado.ScalarAsync<decimal?>("SELECT fn_overtime_pay(@m, @h, @x)", new { m = minutes, h = Math.Round(hourly, 4), x = multiplier }, ct) ?? 0;

    // ------------------------------------------------------------------ workflow: DRAFT -> PROCESSED -> APPROVED -> FINALIZED
    /// <summary>Finalises totals with the existing MySQL stored procedure (also applies adjustments and loan recoveries).</summary>
    public async Task<RunDetailDto> ProcessAsync(string runId, CancellationToken ct)
    {
        var run = await db.PayrollRuns.AsNoTracking().FirstOrDefaultAsync(r => r.Id == runId, ct) ?? throw new NotFoundException("Payroll run not found");
        if (run.Status != "DRAFT") throw new BusinessRuleException("Only DRAFT runs can be processed");
        if (!await db.PayrollEntries.AnyAsync(e => e.RunId == runId, ct)) throw new BusinessRuleException("Calculate the run before processing it");
        await ado.CallProcedureNonQueryAsync("sp_process_monthly_payroll", new { p_run_id = runId, p_user = user.Username ?? "system" }, ct);
        await audit.WriteAsync("PayrollRun", runId, "PROCESSED");
        return await GetAsync(runId, ct);
    }

    public async Task<RunDetailDto> ApproveAsync(string runId, CancellationToken ct)
    {
        var run = await db.PayrollRuns.FirstOrDefaultAsync(r => r.Id == runId, ct) ?? throw new NotFoundException("Payroll run not found");
        if (run.Status != "PROCESSED") throw new BusinessRuleException("Only PROCESSED runs can be approved");
        if (run.ProcessedBy == user.Username) throw new ForbiddenException("Segregation of duties: the processor cannot approve the same run");
        run.Status = "APPROVED"; run.ApprovedBy = user.Username; run.ApprovedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync("PayrollRun", runId, "APPROVED");
        return await GetAsync(runId, ct);
    }

    public async Task<RunDetailDto> FinalizeAsync(string runId, CancellationToken ct)
    {
        var run = await db.PayrollRuns.FirstOrDefaultAsync(r => r.Id == runId, ct) ?? throw new NotFoundException("Payroll run not found");
        if (run.Status != "APPROVED") throw new BusinessRuleException("Only APPROVED runs can be finalized");
        // payslips first (idempotent per entry): a failure leaves the run APPROVED so finalisation can simply be retried
        var generated = await payslips.GenerateForRunAsync(runId, run.PayrollMonth, ct);
        await uow.ExecuteAsync(async () =>
        {
            run.Status = "FINALIZED"; run.FinalizedBy = user.Username; run.FinalizedAt = DateTime.UtcNow;
            var parts = run.PayrollMonth.Split('-');
            events.Publish(Topics.PayrollProcessed, runId, new PayrollProcessedEvent(runId, int.Parse(parts[0]), int.Parse(parts[1]), run.EmployeeCount, run.TotalGross, run.TotalNet, "FINALIZED", user.UserId));
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("PayrollRun", runId, "FINALIZED", null, new { payslips = generated });
        }, ct);
        return await GetAsync(runId, ct);
    }

    /// <summary>Re-runs payslip generation for a finalized run (idempotent: only entries without a payslip are rendered).</summary>
    public async Task<int> GeneratePayslipsAsync(string runId, CancellationToken ct)
    {
        var run = await db.PayrollRuns.AsNoTracking().FirstOrDefaultAsync(r => r.Id == runId, ct) ?? throw new NotFoundException("Payroll run not found");
        if (run.Status != "FINALIZED") throw new BusinessRuleException("Payslips are generated for FINALIZED runs only");
        return await payslips.GenerateForRunAsync(runId, run.PayrollMonth, ct);
    }

    /// <summary>Department and component totals; component aggregation runs on the thread pool (PLINQ) for large runs.</summary>
    public async Task<RunReportDto> ReportAsync(string runId, CancellationToken ct)
    {
        var run = await db.PayrollRuns.AsNoTracking().FirstOrDefaultAsync(r => r.Id == runId, ct) ?? throw new NotFoundException("Payroll run not found");
        var byDept = await ByDepartmentAsync(runId, ct);
        var lines = await (from l in db.PayrollEntryLines.AsNoTracking() join e in db.PayrollEntries on l.EntryId equals e.Id where e.RunId == runId select new { l.ComponentCode, l.Type, l.Amount }).ToListAsync(ct);
        var byComponent = (lines.Count > 1000 ? lines.AsParallel().GroupBy(l => (l.ComponentCode, l.Type)).Select(g => new ComponentTotalDto(g.Key.ComponentCode, g.Key.Type, Math.Round(g.Sum(x => x.Amount), 2))).ToList()
                                              : lines.GroupBy(l => (l.ComponentCode, l.Type)).Select(g => new ComponentTotalDto(g.Key.ComponentCode, g.Key.Type, Math.Round(g.Sum(x => x.Amount), 2))).ToList())
            .OrderBy(c => c.Type).ThenBy(c => c.ComponentCode).ToList();
        return new RunReportDto(ToDto(run), byDept, byComponent);
    }

    public async Task<List<EmployeePayrollHistoryDto>> EmployeeHistoryAsync(string employeeId, CancellationToken ct)
    {
        if (user.EmployeeId != employeeId && !user.HasAnyPermission(Perm.PayrollView, Perm.SalaryManage) && !user.IsSuperAdmin) throw new ForbiddenException("You may only view your own payroll history");
        return await db.PayrollEntries.AsNoTracking().Where(e => e.EmployeeId == employeeId).OrderByDescending(e => e.PayrollMonth).Take(36)
            .Select(e => new EmployeePayrollHistoryDto(e.PayrollMonth, e.Gross, e.Deductions, e.Net, e.PaidDays, e.LopDays, e.RunId)).ToListAsync(ct);
    }
}
