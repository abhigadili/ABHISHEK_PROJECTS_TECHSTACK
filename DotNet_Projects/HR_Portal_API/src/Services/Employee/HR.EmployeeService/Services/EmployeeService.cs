using System.Security.Cryptography;
using System.Text;
using HR.Common.Cache;
using HR.Common.Common;
using HR.Common.Data;
using HR.Common.Messaging;
using HR.Common.Patterns;
using HR.Common.Security;
using HR.Common.Util;
using HR.EmployeeService.Clients;
using HR.EmployeeService.Data;
using HR.EmployeeService.DTOs;
using HR.EmployeeService.Entities;
using HR.EmployeeService.Mapping;
using Mapster;
using Microsoft.EntityFrameworkCore;

namespace HR.EmployeeService.Services;

public interface IEmployeeService
{
    Task<EmployeeProfileDto> OnboardAsync(OnboardEmployeeRequest req, CancellationToken ct);
    Task<PagedResult<DirectoryEntryDto>> DirectoryAsync(DirectoryQuery q, CancellationToken ct);
    Task<EmployeeProfileDto> ProfileAsync(string id, CancellationToken ct);
    Task<EmployeeProfileDto> MyProfileAsync(CancellationToken ct);
    Task<List<TeamMemberDto>> TeamAsync(string managerId, CancellationToken ct);
    Task<EmployeeSummaryDto> SummaryAsync(string id, CancellationToken ct);
    Task<EmployeeProfileDto> UpdateAsync(string id, UpdateEmployeeRequest req, CancellationToken ct);
    Task<EmployeeSummaryDto> ChangeStatusAsync(string id, ChangeStatusRequest req, CancellationToken ct);
    Task DeleteAsync(string id, CancellationToken ct);
    Task<List<HeadcountDto>> HeadcountAsync(CancellationToken ct);
    Task<List<EmploymentHistoryDto>> EmploymentHistoryAsync(string id, CancellationToken ct);
    Task<List<ProfileChangeDto>> ProfileChangesAsync(string id, CancellationToken ct);
    Task<List<StatusHistoryDto>> StatusHistoryAsync(string id, CancellationToken ct);
    Task ApplyExitAsync(string employeeId, DateOnly? exitDate, CancellationToken ct);
    Task ApplyNoticeAsync(string employeeId, CancellationToken ct);
    Task RevertNoticeAsync(string employeeId, CancellationToken ct);
}

public sealed class EmployeeService(EmployeeDbContext db, ICurrentUser user, IOrganizationClient org, ICacheService cache, IFieldCrypto crypto, IEventPublisher events,
    IAuditWriter audit, IUnitOfWork uow, IAdoNet ado) : IEmployeeService
{
    private static readonly Dictionary<string, string[]> Transitions = new()
    {
        ["ACTIVE"] = ["ON_NOTICE", "INACTIVE", "TERMINATED", "RESIGNED"],
        ["ON_NOTICE"] = ["ACTIVE", "RESIGNED", "TERMINATED"],
        ["INACTIVE"] = ["ACTIVE", "TERMINATED"],
        ["RESIGNED"] = ["ACTIVE"],
        ["TERMINATED"] = []
    };
    private static readonly string[] DirectorySort = ["FullName", "EmployeeCode", "JoiningDate", "Status"];
    private static readonly HashSet<string> SelfEditable = ["PersonalEmail", "Phone", "AlternatePhone", "MaritalStatus", "BloodGroup"];
    private static readonly HashSet<string> TrackedFields = ["FirstName", "MiddleName", "LastName", "WorkEmail", "PersonalEmail", "Phone", "AlternatePhone", "DateOfBirth", "Gender", "MaritalStatus", "BloodGroup",
        "Nationality", "NationalId", "PanNumber", "DepartmentId", "DesignationId", "JobGradeId", "LocationId", "ManagerId", "EmploymentType", "ConfirmationDate", "NoticePeriodDays"];
    private static readonly HashSet<string> SensitiveFields = ["NationalId", "PanNumber"];

    private bool IsHr => user.HasAnyPermission(Perm.EmployeeRead, Perm.EmployeeWrite) || user.IsSuperAdmin;
    private bool CanWrite => user.HasPermission(Perm.EmployeeWrite) || user.IsSuperAdmin;
    private bool CanView(Employee e) => IsHr || (user.EmployeeId is { } me && (me == e.Id || me == e.ManagerId));

    // ------------------------------------------------------------------ onboarding
    private async Task ValidateOrgRefsAsync(string? dep, string? des, string? loc, CancellationToken ct)
    {
        // three synchronous service calls issued concurrently (Task.WhenAll)
        var tDep = dep is null ? Task.FromResult<OrgRef?>(new OrgRef("", null, null)) : org.DepartmentAsync(dep, ct);
        var tDes = des is null ? Task.FromResult<OrgRef?>(new OrgRef("", null, null)) : org.DesignationAsync(des, ct);
        var tLoc = loc is null ? Task.FromResult<OrgRef?>(new OrgRef("", null, null)) : org.LocationAsync(loc, ct);
        await Task.WhenAll(tDep, tDes, tLoc);
        var bad = new List<string>();
        if (tDep.Result is null) bad.Add("departmentId: unknown department");
        if (tDes.Result is null) bad.Add("designationId: unknown designation");
        if (tLoc.Result is null) bad.Add("locationId: unknown location");
        if (bad.Count > 0) throw new Common.Common.ValidationException("Unknown organization reference", bad);
    }

    public async Task<EmployeeProfileDto> OnboardAsync(OnboardEmployeeRequest req, CancellationToken ct)
    {
        await ValidateOrgRefsAsync(req.DepartmentId, req.DesignationId, req.LocationId, ct);
        if (await db.Employees.IgnoreQueryFilters().AnyAsync(e => e.WorkEmail == req.WorkEmail, ct)) throw new ConflictException("Work email is already in use");
        if (req.ManagerId is not null && !await db.Employees.AnyAsync(e => e.Id == req.ManagerId, ct)) throw new NotFoundException("Manager not found");

        var emp = req.Adapt<Employee>();
        if (req.PanNumber is not null) emp.PanNumber = crypto.Encrypt(req.PanNumber);
        if (req.NationalId is not null) emp.NationalId = crypto.Encrypt(req.NationalId);
        emp.Status = "ACTIVE";
        emp.Version = 0;
        await uow.ExecuteAsync(async () =>
        {
            emp.EmployeeCode = await NextCodeAsync(ct);
            db.Employees.Add(emp);
            db.EmploymentHistories.Add(new EmploymentHistory { EmployeeId = emp.Id, ChangeType = "JOINED", EffectiveDate = emp.JoiningDate, ToValue = emp.EmployeeCode });
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("Employee", emp.Id, "ONBOARDED", null, new { emp.EmployeeCode, emp.DepartmentId, emp.DesignationId });
            events.Publish(Topics.EmployeeCreated, emp.Id, EmployeeMapping.ToEvent(emp, "CREATED"));
            await db.SaveChangesAsync(ct);
        }, ct);
        await EvictAsync();
        return await ProfileAsync(emp.Id, ct);
    }

    /// <summary>Atomically allocates EMP00001-style codes from the shared employee_sequence row (pessimistic lock inside the onboarding transaction).</summary>
    private async Task<string> NextCodeAsync(CancellationToken ct)
    {
        var seq = (await db.EmployeeSequences.FromSqlInterpolated($"SELECT * FROM employee_sequence WHERE id = 1 FOR UPDATE").ToListAsync(ct)).FirstOrDefault();
        if (seq is null) { seq = new EmployeeSequence { Id = 1, NextValue = 1 }; db.EmployeeSequences.Add(seq); }
        var n = seq.NextValue;
        seq.NextValue = n + 1;
        await db.SaveChangesAsync(ct);
        return $"EMP{n:D5}";
    }

    // ------------------------------------------------------------------ reads
    public async Task<PagedResult<DirectoryEntryDto>> DirectoryAsync(DirectoryQuery q, CancellationToken ct)
    {
        var hash = Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes(q.Key()))).ToLowerInvariant();
        return (await cache.GetOrCreateAsync(CacheKeys.EmployeeDirectory(hash), async c =>
        {
            // each filter is a named Specification; they are composed with AND and translated to one SQL predicate
            var spec = Specification<VwEmployeeDirectory>.All;
            if (!string.IsNullOrWhiteSpace(q.DepartmentId)) spec = spec.And(new ExpressionSpecification<VwEmployeeDirectory>(e => e.DepartmentId == q.DepartmentId));
            if (!string.IsNullOrWhiteSpace(q.LocationId)) spec = spec.And(new ExpressionSpecification<VwEmployeeDirectory>(e => e.LocationId == q.LocationId));
            if (!string.IsNullOrWhiteSpace(q.DesignationId)) spec = spec.And(new ExpressionSpecification<VwEmployeeDirectory>(e => e.DesignationId == q.DesignationId));
            if (!string.IsNullOrWhiteSpace(q.ManagerId)) spec = spec.And(new ExpressionSpecification<VwEmployeeDirectory>(e => e.ManagerId == q.ManagerId));
            if (!string.IsNullOrWhiteSpace(q.Status)) spec = spec.And(new ExpressionSpecification<VwEmployeeDirectory>(e => e.Status == q.Status));
            if (!string.IsNullOrWhiteSpace(q.EmploymentType)) spec = spec.And(new ExpressionSpecification<VwEmployeeDirectory>(e => e.EmploymentType == q.EmploymentType));
            if (!string.IsNullOrWhiteSpace(q.Search))
            {
                var like = $"%{q.Search.Trim().EscapeLike()}%";
                spec = spec.And(new ExpressionSpecification<VwEmployeeDirectory>(e => EF.Functions.Like(e.FullName!, like) || EF.Functions.Like(e.EmployeeCode, like) || EF.Functions.Like(e.WorkEmail, like)));
            }
            var query = db.VwEmployeeDirectories.AsNoTracking().Where(spec);
            query = query.OrderByAllowed(q.Sort, q.Descending, DirectorySort, "FullName");
            return await query.ToPagedAsync(q, e => new DirectoryEntryDto(e.EmployeeId, e.EmployeeCode, e.FullName, e.WorkEmail, e.DepartmentId, e.DesignationId, e.LocationId, e.ManagerId,
                e.Status, e.EmploymentType, e.JoiningDate, e.TenureMonths), c);
        }, CacheKeys.Short, ct))!;
    }

    /// <summary>Profile + organization names + manager + tenure fetched concurrently; PAN / national id masked for non-HR viewers.</summary>
    public async Task<EmployeeProfileDto> ProfileAsync(string id, CancellationToken ct)
    {
        var emp = await db.Employees.AsNoTracking().FirstOrDefaultAsync(e => e.Id == id, ct) ?? throw new NotFoundException("Employee not found");
        if (!CanView(emp)) throw new ForbiddenException("You are not allowed to view this profile");
        var dto = emp.Adapt<EmployeeProfileDto>();

        var tDep = SafeAsync(() => org.DepartmentAsync(emp.DepartmentId, ct));
        var tDes = SafeAsync(() => org.DesignationAsync(emp.DesignationId, ct));
        var tLoc = SafeAsync(() => org.LocationAsync(emp.LocationId, ct));
        var tMgr = emp.ManagerId is null ? Task.FromResult<ManagerRef?>(null)
            : db.Employees.AsNoTracking().Where(m => m.Id == emp.ManagerId).Select(m => new ManagerRef(m.Id, m.FirstName + " " + m.LastName, m.EmployeeCode)).FirstOrDefaultAsync(ct)!;
        var tTenure = ado.ScalarAsync<int?>("SELECT fn_employee_tenure_months(@joined, NULL)", new { joined = emp.JoiningDate.ToDateTime(TimeOnly.MinValue) }, ct);
        await Task.WhenAll(tDep, tDes, tLoc, tMgr, tTenure);
        dto.Department = tDep.Result; dto.Designation = tDes.Result; dto.Location = tLoc.Result; dto.Manager = tMgr.Result; dto.TenureMonths = tTenure.Result;

        var self = user.EmployeeId == emp.Id;
        if (CanWrite || self)
        {
            dto.NationalId = Display(emp.NationalId, CanWrite);
            dto.PanNumber = Display(emp.PanNumber, CanWrite);
        }
        return dto;
    }

    private string? Display(string? stored, bool full)
    {
        var plain = crypto.Reveal(stored);
        return full || plain is null or "[protected]" ? plain : IFieldCrypto.Mask(plain);
    }

    private static async Task<T?> SafeAsync<T>(Func<Task<T?>> call) where T : class
    {
        try { return await call(); } catch (HrException) { return null; }   // a slow/unavailable Organization Service degrades the profile, never fails it
    }

    public async Task<EmployeeProfileDto> MyProfileAsync(CancellationToken ct) =>
        await ProfileAsync(user.EmployeeId ?? throw new NotFoundException("Your account is not linked to an employee"), ct);

    public async Task<List<TeamMemberDto>> TeamAsync(string managerId, CancellationToken ct)
    {
        user.EnsureSelfOr(managerId, Perm.TeamView, Perm.EmployeeRead);
        return await db.Employees.AsNoTracking().Where(e => e.ManagerId == managerId && (e.Status == "ACTIVE" || e.Status == "ON_NOTICE"))
            .OrderBy(e => e.FirstName).Select(e => new TeamMemberDto(e.Id, e.EmployeeCode, e.FirstName + " " + e.LastName, e.WorkEmail, e.Status, e.DesignationId)).ToListAsync(ct);
    }

    /// <summary>Lightweight lookup used by other services (leave, payroll, exit, timesheet ...).</summary>
    public async Task<EmployeeSummaryDto> SummaryAsync(string id, CancellationToken ct)
    {
        var e = await db.Employees.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Employee not found");
        return e.Adapt<EmployeeSummaryDto>();
    }

    // ------------------------------------------------------------------ updates
    public async Task<EmployeeProfileDto> UpdateAsync(string id, UpdateEmployeeRequest req, CancellationToken ct)
    {
        var emp = await db.Employees.FirstOrDefaultAsync(e => e.Id == id, ct) ?? throw new NotFoundException("Employee not found");
        var isSelf = user.EmployeeId == id;
        if (!CanWrite)
        {
            if (!isSelf) throw new ForbiddenException("Only HR may edit another employee");
            var supplied = typeof(UpdateEmployeeRequest).GetProperties().Where(p => p.Name != nameof(req.Version) && p.GetValue(req) is not null).Select(p => p.Name).ToList();
            var bad = supplied.Where(n => !SelfEditable.Contains(n)).ToList();
            if (bad.Count > 0) throw new ForbiddenException($"You may not edit: {string.Join(", ", bad.Select(b => char.ToLowerInvariant(b[0]) + b[1..]))}");
        }
        if (req.Version != emp.Version) throw new ConflictException("The employee was modified by someone else; reload and retry");
        await ValidateOrgRefsAsync(req.DepartmentId, req.DesignationId, req.LocationId, ct);
        if (req.WorkEmail is not null && req.WorkEmail != emp.WorkEmail && await db.Employees.IgnoreQueryFilters().AnyAsync(e => e.WorkEmail == req.WorkEmail, ct)) throw new ConflictException("Work email is already in use");
        if (req.ManagerId is not null)
        {
            if (req.ManagerId == id) throw new BusinessRuleException("An employee cannot be their own manager");
            await AssertNoCycleAsync(id, req.ManagerId, ct);
        }
        var oldPlainPan = crypto.Reveal(emp.PanNumber); var oldPlainNid = crypto.Reveal(emp.NationalId);

        req.Adapt(emp);                                              // partial update mapping (nulls ignored)
        if (req.PanNumber is not null && req.PanNumber != oldPlainPan) emp.PanNumber = crypto.Encrypt(req.PanNumber);
        if (req.NationalId is not null && req.NationalId != oldPlainNid) emp.NationalId = crypto.Encrypt(req.NationalId);
        db.Entry(emp).Property(e => e.Version).OriginalValue = req.Version!.Value;   // optimistic concurrency against the client's version

        // change tracking tells us exactly which tracked columns changed (before -> after)
        var changed = db.Entry(emp).Properties.Where(p => p.IsModified && TrackedFields.Contains(p.Metadata.Name)).ToList();
        if (changed.Count == 0) return await ProfileAsync(id, ct);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var names = changed.Select(p => p.Metadata.Name).ToHashSet();
        var before = changed.ToDictionary(p => p.Metadata.Name, p => p.OriginalValue);
        var after = changed.ToDictionary(p => p.Metadata.Name, p => p.CurrentValue);
        await uow.ExecuteAsync(async () =>
        {
            foreach (var p in changed)
            {
                var sensitive = SensitiveFields.Contains(p.Metadata.Name);
                db.ProfileChangeLogs.Add(new ProfileChangeLog
                {
                    EmployeeId = id, FieldName = p.Metadata.Name,
                    OldValue = sensitive ? "[MASKED]" : Trunc(p.OriginalValue), NewValue = sensitive ? "[MASKED]" : Trunc(p.CurrentValue)
                });
            }
            if (names.Contains("DepartmentId") || names.Contains("LocationId"))
                db.EmploymentHistories.Add(new EmploymentHistory { EmployeeId = id, ChangeType = "TRANSFER", FromValue = before.GetValueOrDefault("DepartmentId")?.ToString(), ToValue = emp.DepartmentId, EffectiveDate = today });
            if (names.Contains("DesignationId"))
                db.EmploymentHistories.Add(new EmploymentHistory { EmployeeId = id, ChangeType = "PROMOTION", FromValue = before["DesignationId"]?.ToString(), ToValue = emp.DesignationId, EffectiveDate = today });
            if (names.Contains("ManagerId"))
                db.EmploymentHistories.Add(new EmploymentHistory { EmployeeId = id, ChangeType = "MANAGER_CHANGE", FromValue = before["ManagerId"]?.ToString(), ToValue = emp.ManagerId, EffectiveDate = today });
            events.Publish(Topics.EmployeeUpdated, id, EmployeeMapping.ToEvent(emp, "UPDATED"));
            await db.SaveChangesAsync(ct);   // throws DbUpdateConcurrencyException (-> 409) if another writer bumped the version
            await audit.WriteAsync("Employee", id, "PROFILE_UPDATED", before, after);
        }, ct);
        await EvictAsync();
        return await ProfileAsync(id, ct);
    }

    private static string? Trunc(object? v) { var s = v?.ToString(); return s is null ? null : s.Length > 250 ? s[..250] : s; }

    private async Task AssertNoCycleAsync(string id, string newManagerId, CancellationToken ct)
    {
        // recursive CTE walks the proposed manager's chain upward; if it reaches the employee, the assignment would create a cycle
        var hit = await ado.QueryAsync(
            """
            WITH RECURSIVE chain AS (
              SELECT id, manager_id, 1 AS depth FROM employees WHERE id = @mgr
              UNION ALL
              SELECT e.id, e.manager_id, c.depth + 1 FROM employees e JOIN chain c ON e.id = c.manager_id WHERE c.depth < 50)
            SELECT id FROM chain WHERE id = @emp
            """, r => r.GetString(0), new { mgr = newManagerId, emp = id }, ct);
        if (hit.Count > 0) throw new BusinessRuleException("Manager assignment would create a reporting cycle");
    }

    public async Task<EmployeeSummaryDto> ChangeStatusAsync(string id, ChangeStatusRequest req, CancellationToken ct)
    {
        var emp = await db.Employees.FirstOrDefaultAsync(e => e.Id == id, ct) ?? throw new NotFoundException("Employee not found");
        if (emp.Status == req.Status) return emp.Adapt<EmployeeSummaryDto>();
        if (!Transitions[emp.Status].Contains(req.Status)) throw new BusinessRuleException($"Cannot change status from {emp.Status} to {req.Status}");
        if (req.Status is "TERMINATED" or "RESIGNED" && (req.ExitDate ?? emp.ExitDate) is null) throw new Common.Common.ValidationException("exitDate is required for this status");
        var from = emp.Status;
        emp.Status = req.Status;
        if (req.ExitDate is not null) emp.ExitDate = req.ExitDate;
        if (req.Status == "ACTIVE") emp.ExitDate = null;
        var topic = req.Status == "TERMINATED" ? Topics.EmployeeTerminated : Topics.EmployeeUpdated;
        await uow.ExecuteAsync(async () =>
        {
            // employee_status_history is written by the existing DB trigger on employees.status
            db.EmploymentHistories.Add(new EmploymentHistory { EmployeeId = id, ChangeType = "STATUS_CHANGE", FromValue = from, ToValue = req.Status, Reason = req.Reason, EffectiveDate = req.ExitDate ?? DateOnly.FromDateTime(DateTime.UtcNow) });
            events.Publish(topic, id, EmployeeMapping.ToEvent(emp, req.Status == "TERMINATED" ? "TERMINATED" : "STATUS_CHANGED"));
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("Employee", id, "STATUS_CHANGED", new { status = from }, new { status = req.Status, req.Reason });
        }, ct);
        await EvictAsync();
        return emp.Adapt<EmployeeSummaryDto>();
    }

    /// <summary>Consumer path: the Exit Service finished offboarding => RESIGNED (idempotent; publishes an authoritative snapshot).</summary>
    public async Task ApplyExitAsync(string employeeId, DateOnly? exitDate, CancellationToken ct)
    {
        var e = await db.Employees.FirstOrDefaultAsync(x => x.Id == employeeId, ct);
        if (e is null || e.Status is "RESIGNED" or "TERMINATED") return;
        var from = e.Status;
        e.Status = "RESIGNED"; e.ExitDate = exitDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        db.EmploymentHistories.Add(new EmploymentHistory { EmployeeId = employeeId, ChangeType = "STATUS_CHANGE", FromValue = from, ToValue = "RESIGNED", EffectiveDate = e.ExitDate.Value, Reason = "Exit workflow completed" });
        events.Publish(Topics.EmployeeUpdated, employeeId, EmployeeMapping.ToEvent(e, "EXITED"));
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync("Employee", employeeId, "EXITED", new { status = from }, new { status = "RESIGNED" });
        await EvictAsync();
    }

    public async Task ApplyNoticeAsync(string employeeId, CancellationToken ct)
    {
        var e = await db.Employees.FirstOrDefaultAsync(x => x.Id == employeeId, ct);
        if (e is null || e.Status != "ACTIVE") return;
        e.Status = "ON_NOTICE";
        events.Publish(Topics.EmployeeUpdated, employeeId, EmployeeMapping.ToEvent(e, "ON_NOTICE"));
        await db.SaveChangesAsync(ct);
        await EvictAsync();
    }

    public async Task RevertNoticeAsync(string employeeId, CancellationToken ct)
    {
        var e = await db.Employees.FirstOrDefaultAsync(x => x.Id == employeeId, ct);
        if (e is null || e.Status != "ON_NOTICE") return;
        e.Status = "ACTIVE";
        events.Publish(Topics.EmployeeUpdated, employeeId, EmployeeMapping.ToEvent(e, "NOTICE_WITHDRAWN"));
        await db.SaveChangesAsync(ct);
        await EvictAsync();
    }

    public async Task DeleteAsync(string id, CancellationToken ct)
    {
        var e = await db.Employees.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Employee not found");
        if (e.Status == "ACTIVE") throw new BusinessRuleException("Active employees cannot be deleted; change their status first");
        e.Deleted = true; e.DeletedAt = DateTime.UtcNow;     // soft delete (global query filter hides the row afterwards)
        await uow.ExecuteAsync(async () => { await db.SaveChangesAsync(ct); await audit.WriteAsync("Employee", id, "DELETED"); }, ct);
        await EvictAsync();
    }

    public async Task<List<HeadcountDto>> HeadcountAsync(CancellationToken ct) =>
        await db.Employees.AsNoTracking().GroupBy(e => new { e.DepartmentId, e.Status })
            .Select(g => new HeadcountDto(g.Key.DepartmentId, g.Key.Status, g.Count())).OrderBy(h => h.DepartmentId).ThenBy(h => h.Status).ToListAsync(ct);

    // ------------------------------------------------------------------ histories
    public async Task<List<EmploymentHistoryDto>> EmploymentHistoryAsync(string id, CancellationToken ct)
    {
        var e = await db.Employees.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Employee not found");
        if (!CanView(e)) throw new ForbiddenException();
        return await db.EmploymentHistories.AsNoTracking().Where(h => h.EmployeeId == id).OrderByDescending(h => h.EffectiveDate).ThenByDescending(h => h.CreatedAt)
            .Select(h => new EmploymentHistoryDto(h.Id, h.ChangeType, h.EffectiveDate, h.FromValue, h.ToValue, h.Reason, h.CreatedAt)).ToListAsync(ct);
    }

    public async Task<List<ProfileChangeDto>> ProfileChangesAsync(string id, CancellationToken ct) =>
        await db.ProfileChangeLogs.AsNoTracking().Where(h => h.EmployeeId == id).OrderByDescending(h => h.CreatedAt).Take(200)
            .Select(h => new ProfileChangeDto(h.Id, h.FieldName, h.OldValue, h.NewValue, h.CreatedBy, h.CreatedAt)).ToListAsync(ct);

    public async Task<List<StatusHistoryDto>> StatusHistoryAsync(string id, CancellationToken ct) =>
        await db.EmployeeStatusHistories.AsNoTracking().Where(h => h.EmployeeId == id).OrderByDescending(h => h.ChangedAt)
            .Select(h => new StatusHistoryDto(h.Id, h.OldStatus, h.NewStatus, h.ChangedAt, h.ChangedBy)).ToListAsync(ct);

    private Task EvictAsync() => cache.EvictPrefixAsync(CacheKeys.EmployeePrefix);
}
