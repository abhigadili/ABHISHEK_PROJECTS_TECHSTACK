using HR.Common.Cache;
using HR.Common.Common;
using HR.Common.Crud;
using HR.Common.Data;
using HR.Common.Security;
using HR.PayrollService.Data;
using HR.PayrollService.DTOs;
using HR.PayrollService.Engine;
using HR.PayrollService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.PayrollService.Services;

public sealed class SalaryComponentService(PayrollDbContext db, IAuditWriter audit, ICacheService cache) : CrudService<SalaryComponent, SalaryComponentRequest, SalaryComponentDto>(db, audit, cache)
{
    protected override string Label => "SalaryComponent";
    protected override string[] SortFields => ["DisplayOrder", "Code", "Name"];
    protected override string DefaultSort => "DisplayOrder";
    protected override string[] SearchFields => ["Code", "Name"];

    protected override async Task BeforeCreateAsync(SalaryComponent e, SalaryComponentRequest r, CancellationToken ct)
    {
        if (await db.SalaryComponents.IgnoreQueryFilters().AnyAsync(c => c.Code == e.Code, ct)) throw new ConflictException("Component code already exists");
        if (e.CalcType == "BALANCE" && await db.SalaryComponents.AnyAsync(c => c.CalcType == "BALANCE" && c.Active, ct)) throw new BusinessRuleException("Only one BALANCE component may be active");
    }

    protected override async Task BeforeUpdateAsync(SalaryComponent e, SalaryComponentRequest r, CancellationToken ct)
    {
        var original = await db.SalaryComponents.AsNoTracking().Where(c => c.Id == e.Id).Select(c => c.Code).FirstAsync(ct);
        if (e.Code != original) throw new Common.Common.ValidationException("Component code cannot be changed");
    }
}

public interface ISalaryService
{
    Task<Dictionary<string, string>> SettingsAsync(CancellationToken ct);
    Task<List<ConfigDto>> ListConfigAsync(CancellationToken ct);
    Task<List<ConfigDto>> UpdateConfigAsync(UpdateConfigRequest r, CancellationToken ct);
    Task<List<StructureDto>> ListStructuresAsync(CancellationToken ct);
    Task<StructureDto> GetStructureAsync(string id, CancellationToken ct);
    Task<StructureDto> CreateStructureAsync(StructureRequest r, CancellationToken ct);
    Task<StructureDto> UpdateStructureAsync(string id, StructureUpdateRequest r, CancellationToken ct);
    Task<SalaryDto> AssignAsync(AssignSalaryRequest r, CancellationToken ct);
    Task<EmployeeSalaryDto> EmployeeSalaryAsync(string employeeId, CancellationToken ct);
    Task<RevisionDto> RequestRevisionAsync(RevisionRequest r, CancellationToken ct);
    Task<List<RevisionDto>> ListRevisionsAsync(string? status, string? employeeId, CancellationToken ct);
    Task<RevisionDto> DecideRevisionAsync(string id, bool approve, string? comment, CancellationToken ct);
}

public sealed class SalaryService(PayrollDbContext db, ICacheService cache, ICurrentUser user, IAuditWriter audit, IUnitOfWork uow) : ISalaryService
{
    private static SalaryDto ToDto(EmployeeSalary s) => new(s.Id, s.EmployeeId, s.StructureId, s.AnnualCtc, s.Currency, s.EffectiveFrom, s.EffectiveTo, s.Status, s.Version);
    private static RevisionDto ToDto(SalaryRevision r) => new(r.Id, r.EmployeeId, r.OldCtc, r.NewCtc, r.NewStructureId, r.EffectiveFrom, r.Reason, r.Status, r.DecisionComment, r.DecidedAt, r.CreatedAt);

    // ------------------------------------------------------------------ configuration (statutory values live in payroll_config, never in code)
    private async Task<List<ConfigDto>> LatestConfigAsync(CancellationToken ct) =>
        (await db.PayrollConfigs.AsNoTracking().ToListAsync(ct)).GroupBy(c => c.ConfigKey).Select(g => g.OrderByDescending(c => c.EffectiveFrom).First())
        .Select(c => new ConfigDto(c.ConfigKey, c.ConfigValue, c.Description, c.EffectiveFrom)).OrderBy(c => c.Key).ToList();

    public async Task<Dictionary<string, string>> SettingsAsync(CancellationToken ct)
    {
        var list = await cache.GetOrCreateAsync("payroll:config", async c => await LatestConfigAsync(c), CacheKeys.Medium, ct) ?? [];
        return list.ToDictionary(c => c.Key, c => c.Value);
    }

    public Task<List<ConfigDto>> ListConfigAsync(CancellationToken ct) => LatestConfigAsync(ct);

    public async Task<List<ConfigDto>> UpdateConfigAsync(UpdateConfigRequest r, CancellationToken ct)
    {
        await uow.ExecuteAsync(async () =>
        {
            foreach (var i in r.Items)
            {
                db.PayrollConfigs.Add(new PayrollConfig { ConfigKey = i.Key, ConfigValue = i.Value, Description = i.Description, EffectiveFrom = DateTime.UtcNow });
                await audit.WriteAsync("PayrollConfig", i.Key, "CHANGED", null, new { value = i.Value });
            }
            await db.SaveChangesAsync(ct);
        }, ct);
        await cache.RemoveAsync("payroll:config", ct);
        return await LatestConfigAsync(ct);
    }

    // ------------------------------------------------------------------ structures
    public async Task<List<StructureDto>> ListStructuresAsync(CancellationToken ct)
    {
        var structures = await db.SalaryStructures.AsNoTracking().OrderBy(s => s.Name).ToListAsync(ct);
        var comps = await ComponentsForAsync(structures.Select(s => s.Id).ToList(), ct);
        return structures.Select(s => new StructureDto(s.Id, s.Name, s.Description, s.Active, comps[s.Id].ToList())).ToList();
    }

    public async Task<StructureDto> GetStructureAsync(string id, CancellationToken ct)
    {
        var s = await db.SalaryStructures.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Salary structure not found");
        return new StructureDto(s.Id, s.Name, s.Description, s.Active, (await ComponentsForAsync([id], ct))[id].ToList());
    }

    private async Task<ILookup<string, StructureComponentDto>> ComponentsForAsync(List<string> structureIds, CancellationToken ct)
    {
        var rows = await (from sc in db.SalaryStructureComponents.AsNoTracking()
                          join c in db.SalaryComponents.IgnoreQueryFilters() on sc.ComponentId equals c.Id
                          where structureIds.Contains(sc.StructureId) orderby c.DisplayOrder
                          select new { sc.StructureId, Dto = new StructureComponentDto(c.Id, c.Code, c.Name, c.Type, c.CalcType, sc.Value, c.DisplayOrder) }).ToListAsync(ct);
        return rows.ToLookup(r => r.StructureId, r => r.Dto);
    }

    /// <summary>Salary component validation: known components, percentages within 100, percent-of-CTC total within 100, BASIC present.</summary>
    private async Task ValidateStructureAsync(List<StructureComponentItem> items, CancellationToken ct)
    {
        var ids = items.Select(i => i.ComponentId).Distinct().ToList();
        var comps = await db.SalaryComponents.AsNoTracking().Where(c => ids.Contains(c.Id)).ToDictionaryAsync(c => c.Id, ct);
        if (comps.Count != ids.Count) throw new Common.Common.ValidationException("Unknown component in structure");
        foreach (var i in items)
            if (comps[i.ComponentId].CalcType is "PERCENT_OF_CTC" or "PERCENT_OF_BASIC" && i.Value > 100) throw new Common.Common.ValidationException($"{comps[i.ComponentId].Code}: percentage cannot exceed 100");
        if (items.Where(i => comps[i.ComponentId].CalcType == "PERCENT_OF_CTC").Sum(i => i.Value) > 100) throw new Common.Common.ValidationException("Percent-of-CTC components exceed 100%");
        if (!comps.Values.Any(c => c.Code == "BASIC")) throw new Common.Common.ValidationException("A structure must include the BASIC component");
    }

    private async Task ReplaceComponentsAsync(string structureId, List<StructureComponentItem> items, CancellationToken ct)
    {
        db.SalaryStructureComponents.RemoveRange(await db.SalaryStructureComponents.Where(c => c.StructureId == structureId).ToListAsync(ct));
        await db.SaveChangesAsync(ct);
        foreach (var i in items) db.SalaryStructureComponents.Add(new SalaryStructureComponent { StructureId = structureId, ComponentId = i.ComponentId, Value = i.Value });
        await db.SaveChangesAsync(ct);
    }

    public async Task<StructureDto> CreateStructureAsync(StructureRequest r, CancellationToken ct)
    {
        await ValidateStructureAsync(r.Components, ct);
        var s = new SalaryStructure { Name = r.Name, Description = r.Description, Active = r.Active };
        await uow.ExecuteAsync(async () =>
        {
            db.SalaryStructures.Add(s);
            await db.SaveChangesAsync(ct);
            await ReplaceComponentsAsync(s.Id, r.Components, ct);
            await audit.WriteAsync("SalaryStructure", s.Id, "CREATED", null, r);
        }, ct);
        return await GetStructureAsync(s.Id, ct);
    }

    public async Task<StructureDto> UpdateStructureAsync(string id, StructureUpdateRequest r, CancellationToken ct)
    {
        var s = await db.SalaryStructures.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Salary structure not found");
        if (r.Components is not null) await ValidateStructureAsync(r.Components, ct);
        await uow.ExecuteAsync(async () =>
        {
            s.Name = r.Name ?? s.Name; s.Description = r.Description ?? s.Description; if (r.Active is { } a) s.Active = a;
            await db.SaveChangesAsync(ct);
            if (r.Components is not null) await ReplaceComponentsAsync(id, r.Components, ct);
            await audit.WriteAsync("SalaryStructure", id, "UPDATED", null, r);
        }, ct);
        return await GetStructureAsync(id, ct);
    }

    // ------------------------------------------------------------------ salary assignment (history rows are written by the DB triggers)
    public async Task<SalaryDto> AssignAsync(AssignSalaryRequest r, CancellationToken ct)
    {
        if (!await db.SalaryStructures.AnyAsync(s => s.Id == r.StructureId, ct)) throw new NotFoundException("Salary structure not found");
        var from = r.EffectiveFrom!.Value;
        EmployeeSalary created = null!;
        await uow.ExecuteAsync(async () =>
        {
            var current = (await db.EmployeeSalaries.FromSqlInterpolated($"SELECT * FROM employee_salaries WHERE employee_id = {r.EmployeeId} AND status = 'ACTIVE' ORDER BY effective_from DESC LIMIT 1 FOR UPDATE").ToListAsync(ct)).FirstOrDefault();
            if (current is not null)
            {
                if (from <= current.EffectiveFrom) throw new BusinessRuleException("effectiveFrom must be after the current salary effective date");
                current.Status = "SUPERSEDED"; current.EffectiveTo = from.AddDays(-1);
            }
            created = new EmployeeSalary { EmployeeId = r.EmployeeId, StructureId = r.StructureId, AnnualCtc = r.AnnualCtc, Currency = r.Currency, EffectiveFrom = from, Status = "ACTIVE" };
            db.EmployeeSalaries.Add(created);
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("EmployeeSalary", r.EmployeeId, "ASSIGNED", null, new { r.StructureId, effectiveFrom = from });
        }, ct);
        return ToDto(created);
    }

    public async Task<EmployeeSalaryDto> EmployeeSalaryAsync(string employeeId, CancellationToken ct)
    {
        if (user.EmployeeId != employeeId && !user.HasAnyPermission(Perm.PayrollView, Perm.SalaryManage) && !user.IsSuperAdmin) throw new ForbiddenException("You may only view your own salary");
        var summary = await db.VwEmployeeSalarySummaries.AsNoTracking().Where(s => s.EmployeeId == employeeId).OrderByDescending(s => s.EffectiveFrom).FirstOrDefaultAsync(ct);
        var history = await db.EmployeeSalaries.AsNoTracking().Where(s => s.EmployeeId == employeeId).OrderByDescending(s => s.EffectiveFrom).ToListAsync(ct);
        var revisions = await db.SalaryRevisionHistories.AsNoTracking().Where(h => h.EmployeeId == employeeId).OrderByDescending(h => h.ChangedAt).Take(100)
            .Select(h => new RevisionHistoryDto(h.Id, h.SalaryId, h.Action, h.OldCtc, h.NewCtc, h.OldStatus, h.NewStatus, h.EffectiveFrom, h.ChangedAt, h.ChangedBy)).ToListAsync(ct);
        return new EmployeeSalaryDto(summary is null ? null : new SalarySummaryDto(summary.EmployeeId, summary.StructureName, summary.AnnualCtc, summary.MonthlyCtc, summary.MonthlyBasic, summary.Currency, summary.EffectiveFrom),
            history.Select(ToDto).ToList(), revisions);
    }

    // ------------------------------------------------------------------ revisions (maker / checker)
    public async Task<RevisionDto> RequestRevisionAsync(RevisionRequest r, CancellationToken ct)
    {
        var current = await db.EmployeeSalaries.AsNoTracking().Where(s => s.EmployeeId == r.EmployeeId && s.Status == "ACTIVE").OrderByDescending(s => s.EffectiveFrom).FirstOrDefaultAsync(ct)
                      ?? throw new BusinessRuleException("Employee has no active salary to revise");
        if (await db.SalaryRevisions.AnyAsync(v => v.EmployeeId == r.EmployeeId && v.Status == "PENDING", ct)) throw new ConflictException("A revision for this employee is already pending");
        if (r.NewCtc == current.AnnualCtc && r.NewStructureId is null) throw new BusinessRuleException("Revision does not change anything");
        var rev = new SalaryRevision { EmployeeId = r.EmployeeId, OldCtc = current.AnnualCtc, NewCtc = r.NewCtc, NewStructureId = r.NewStructureId ?? current.StructureId, EffectiveFrom = r.EffectiveFrom!.Value, Reason = r.Reason, Status = "PENDING" };
        db.SalaryRevisions.Add(rev);
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync("SalaryRevision", rev.Id, "REQUESTED", null, new { r.NewCtc, pct = Math.Round((r.NewCtc - current.AnnualCtc) / current.AnnualCtc * 100, 2) });
        return ToDto(rev);
    }

    public async Task<List<RevisionDto>> ListRevisionsAsync(string? status, string? employeeId, CancellationToken ct)
    {
        var q = db.SalaryRevisions.AsNoTracking().AsQueryable();
        if (!string.IsNullOrEmpty(status)) q = q.Where(r => r.Status == status);
        if (!string.IsNullOrEmpty(employeeId)) q = q.Where(r => r.EmployeeId == employeeId);
        return (await q.OrderByDescending(r => r.CreatedAt).Take(200).ToListAsync(ct)).Select(ToDto).ToList();
    }

    public async Task<RevisionDto> DecideRevisionAsync(string id, bool approve, string? comment, CancellationToken ct)
    {
        var rev = await db.SalaryRevisions.FirstOrDefaultAsync(r => r.Id == id, ct) ?? throw new NotFoundException("Salary revision not found");
        if (rev.Status != "PENDING") throw new BusinessRuleException($"Revision is already {rev.Status}");
        if (rev.CreatedBy == user.UserId) throw new ForbiddenException("A revision cannot be approved by the person who requested it");
        await uow.ExecuteAsync(async () =>
        {
            rev.Status = approve ? "APPROVED" : "REJECTED"; rev.DecidedBy = user.UserId; rev.DecidedAt = DateTime.UtcNow; rev.DecisionComment = comment;
            if (approve)
            {
                var cur = (await db.EmployeeSalaries.FromSqlInterpolated($"SELECT * FROM employee_salaries WHERE employee_id = {rev.EmployeeId} AND status = 'ACTIVE' ORDER BY effective_from DESC LIMIT 1 FOR UPDATE").ToListAsync(ct)).FirstOrDefault();
                var from = cur is null || rev.EffectiveFrom > cur.EffectiveFrom ? rev.EffectiveFrom : cur.EffectiveFrom.AddDays(1);
                if (cur is not null) { cur.Status = "SUPERSEDED"; cur.EffectiveTo = from.AddDays(-1); }
                db.EmployeeSalaries.Add(new EmployeeSalary { EmployeeId = rev.EmployeeId, StructureId = rev.NewStructureId ?? cur?.StructureId ?? "", AnnualCtc = rev.NewCtc, Currency = cur?.Currency ?? "INR", EffectiveFrom = from, Status = "ACTIVE" });
            }
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("SalaryRevision", id, approve ? "APPROVED" : "REJECTED", null, new { comment });
        }, ct);
        return ToDto(rev);
    }
}
