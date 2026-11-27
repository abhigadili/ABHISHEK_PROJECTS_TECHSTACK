using HR.Common.Common;
using HR.Common.Data;
using HR.Common.Security;
using HR.ProjectService.Clients;
using HR.ProjectService.Data;
using HR.ProjectService.DTOs;
using HR.ProjectService.Entities;
using Mapster;
using Microsoft.EntityFrameworkCore;

namespace HR.ProjectService.Services;

public interface IProjectService
{
    Task<ProjectDto> CreateAsync(ProjectRequest r, CancellationToken ct);
    Task<PagedResult<ProjectDto>> ListAsync(ProjectListQuery q, CancellationToken ct);
    Task<ProjectDetailDto> GetAsync(string id, CancellationToken ct);
    Task<ProjectDto> UpdateAsync(string id, ProjectUpdateRequest r, CancellationToken ct);
    Task<ProjectDto> ChangeStatusAsync(string id, string status, string? reason, CancellationToken ct);
    Task DeleteAsync(string id, CancellationToken ct);
    Task<List<ProjectHistoryDto>> HistoryAsync(string id, CancellationToken ct);
    Task<AllocationDto> AllocateAsync(string projectId, AllocationRequest r, CancellationToken ct);
    Task<AllocationDto> UpdateAllocationAsync(string projectId, string allocId, AllocationUpdateRequest r, CancellationToken ct);
    Task<AllocationDto> EndAllocationAsync(string projectId, string allocId, DateOnly? endDate, CancellationToken ct);
    Task<AllocationCheckDto> AllocationCheckAsync(string projectId, string employeeId, DateOnly date, CancellationToken ct);
    Task<List<EmployeeProjectDto>> EmployeeProjectsAsync(string employeeId, CancellationToken ct);
    Task<List<Dictionary<string, object?>>> AllocationSummaryAsync(string employeeId, DateOnly? date, CancellationToken ct);
    Task EndAllocationsForExitAsync(string employeeId, DateOnly day, CancellationToken ct);
}

public sealed class ProjectService(ProjectDbContext db, ICurrentUser user, IEmployeeClient employees, IAdoNet ado, IAuditWriter audit, IUnitOfWork uow) : IProjectService
{
    private static readonly Dictionary<string, string[]> Transitions = new()
    {
        ["PLANNED"] = ["ACTIVE", "CANCELLED"], ["ACTIVE"] = ["ON_HOLD", "COMPLETED", "CANCELLED"], ["ON_HOLD"] = ["ACTIVE", "CANCELLED", "COMPLETED"], ["COMPLETED"] = [], ["CANCELLED"] = []
    };

    private bool CanManage(Project p) => user.HasPermission(Perm.ProjectManage) && (p.ProjectManagerId == user.EmployeeId || user.IsSuperAdmin);
    private bool SeesBilling(Project p) => user.HasPermission(Perm.PayrollView) || CanManage(p);
    private ProjectDto View(Project p)
    {
        var billing = SeesBilling(p);
        return new ProjectDto(p.Id, p.Code, p.Name, p.Description, p.CustomerId, p.ProjectManagerId, p.StartDate, p.EndDate, p.Status, p.Version, p.CreatedAt, p.UpdatedAt,
            billing ? p.BillingModel : null, billing ? p.BillingRate : null, billing ? p.BillingContactId : null, billing ? p.BillingNotes : null, billing ? p.Budget : null, billing ? p.Currency : null);
    }
    private static AllocationDto ToDto(ProjectAllocation a) => new(a.Id, a.ProjectId, a.EmployeeId, a.EmployeeName, a.Role, a.AllocationPercent, a.Billable, a.StartDate, a.EndDate, a.Status);
    private void History(string projectId, string type, object? oldV, object? newV) =>
        db.ProjectHistories.Add(new ProjectHistory { ProjectId = projectId, ChangeType = type, OldValue = Trunc(oldV), NewValue = Trunc(newV) });
    private static string? Trunc(object? v) { var s = v?.ToString(); return s is null ? null : s.Length > 250 ? s[..250] : s; }

    public async Task<ProjectDto> CreateAsync(ProjectRequest r, CancellationToken ct)
    {
        if (await db.Projects.IgnoreQueryFilters().AnyAsync(p => p.Code == r.Code, ct)) throw new ConflictException("Project code already exists");
        if (!await db.Customers.AnyAsync(c => c.Id == r.CustomerId, ct)) throw new NotFoundException("Customer not found");
        var pm = await employees.SummaryAsync(r.ProjectManagerId, ct) ?? throw new Common.Common.ValidationException("Project manager is not a valid employee");
        if (pm.Status is not ("ACTIVE" or "ON_NOTICE")) throw new Common.Common.ValidationException("Project manager must be an active employee");
        var p = r.Adapt<Project>();
        p.StartDate = r.StartDate!.Value;
        p.Status = p.StartDate <= DateOnly.FromDateTime(DateTime.UtcNow) ? "ACTIVE" : "PLANNED";
        await uow.ExecuteAsync(async () =>
        {
            db.Projects.Add(p);
            await db.SaveChangesAsync(ct);
            History(p.Id, "CREATED", null, p.Status);
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("Project", p.Id, "CREATED", null, new { r.Code });
        }, ct);
        return View(p);
    }

    public async Task<PagedResult<ProjectDto>> ListAsync(ProjectListQuery q, CancellationToken ct)
    {
        var query = db.Projects.AsNoTracking().AsQueryable();
        if (!string.IsNullOrEmpty(q.Status)) query = query.Where(p => p.Status == q.Status);
        if (!string.IsNullOrEmpty(q.CustomerId)) query = query.Where(p => p.CustomerId == q.CustomerId);
        if (!string.IsNullOrEmpty(q.ProjectManagerId)) query = query.Where(p => p.ProjectManagerId == q.ProjectManagerId);
        if (!user.HasAnyPermission(Perm.ProjectManage, Perm.ReportView, Perm.PayrollView) && !user.IsSuperAdmin)
        {
            var me = user.EmployeeId ?? "-";
            query = query.Where(p => p.ProjectManagerId == me || db.ProjectAllocations.Any(a => a.ProjectId == p.Id && a.EmployeeId == me));
        }
        if (!string.IsNullOrWhiteSpace(q.Search)) { var like = $"%{q.Search.Trim().EscapeLike()}%"; query = query.Where(p => EF.Functions.Like(p.Name, like) || EF.Functions.Like(p.Code, like)); }
        query = query.OrderByAllowed(q.Sort, q.Descending, ["Name", "Code", "StartDate", "Status", "CreatedAt"], "Name");
        var total = await query.LongCountAsync(ct);
        var rows = await query.Skip((q.Page - 1) * q.Size).Take(q.Size).ToListAsync(ct);
        return PagedResult<ProjectDto>.Of(rows.Select(View).ToList(), q.Page, q.Size, total);
    }

    public async Task<ProjectDetailDto> GetAsync(string id, CancellationToken ct)
    {
        var p = await db.Projects.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Project not found");
        var team = await db.ProjectAllocations.AsNoTracking().Where(a => a.ProjectId == id).OrderBy(a => a.Status).ThenBy(a => a.StartDate).ToListAsync(ct);
        var allowed = user.HasAnyPermission(Perm.ProjectManage, Perm.ReportView, Perm.PayrollView) || user.IsSuperAdmin || team.Any(t => t.EmployeeId == user.EmployeeId) || p.ProjectManagerId == user.EmployeeId;
        if (!allowed) throw new ForbiddenException("You are not part of this project");
        return new ProjectDetailDto(View(p), team.Select(ToDto).ToList());
    }

    public async Task<ProjectDto> UpdateAsync(string id, ProjectUpdateRequest r, CancellationToken ct)
    {
        var p = await db.Projects.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Project not found");
        if (!CanManage(p)) throw new ForbiddenException("Only the project manager can edit this project");
        if (r.Version != p.Version) throw new ConflictException("The project was modified by someone else; reload and retry");
        if (p.Status is "COMPLETED" or "CANCELLED") throw new BusinessRuleException($"A {p.Status} project cannot be edited");
        var start = r.StartDate ?? p.StartDate; var end = r.EndDate ?? p.EndDate;
        if (end < start) throw new Common.Common.ValidationException("endDate must not precede startDate");
        if (r.Code is not null && r.Code != p.Code && await db.Projects.IgnoreQueryFilters().AnyAsync(x => x.Code == r.Code, ct)) throw new ConflictException("Project code already exists");
        if (r.ProjectManagerId is not null && r.ProjectManagerId != p.ProjectManagerId && !user.IsSuperAdmin) throw new ForbiddenException("Only an administrator can reassign the project manager");
        r.Adapt(p);
        db.Entry(p).Property(x => x.Version).OriginalValue = r.Version!.Value;
        var changes = db.Entry(p).Properties.Where(x => x.IsModified && x.Metadata.Name is not ("Version" or "UpdatedAt" or "UpdatedBy")).Select(x => (x.Metadata.Name, x.OriginalValue, x.CurrentValue)).ToList();
        await uow.ExecuteAsync(async () =>
        {
            foreach (var (name, o, n) in changes) History(id, name.ToUpperInvariant(), o, n);
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("Project", id, "UPDATED", changes.ToDictionary(c => c.Name, c => c.OriginalValue), changes.ToDictionary(c => c.Name, c => c.CurrentValue));
        }, ct);
        return View(p);
    }

    public async Task<ProjectDto> ChangeStatusAsync(string id, string status, string? reason, CancellationToken ct)
    {
        var p = await db.Projects.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Project not found");
        if (!CanManage(p)) throw new ForbiddenException("Only the project manager can change the status");
        if (!Transitions[p.Status].Contains(status)) throw new BusinessRuleException($"Cannot move a {p.Status} project to {status}");
        var from = p.Status; var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await uow.ExecuteAsync(async () =>
        {
            p.Status = status;
            if (status == "COMPLETED" && p.EndDate is null) p.EndDate = today;
            if (status is "COMPLETED" or "CANCELLED")
                foreach (var a in await db.ProjectAllocations.Where(a => a.ProjectId == id && a.Status == "ACTIVE").ToListAsync(ct)) { a.Status = "ENDED"; a.EndDate = a.EndDate is { } e && e < today ? e : today; }
            History(id, "STATUS", from, status);
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("Project", id, "STATUS_CHANGED", new { status = from }, new { status, reason });
        }, ct);
        return View(p);
    }

    public async Task DeleteAsync(string id, CancellationToken ct)
    {
        var p = await db.Projects.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Project not found");
        if (!CanManage(p)) throw new ForbiddenException();
        if (p.Status == "ACTIVE") throw new BusinessRuleException("Active projects cannot be deleted");
        p.Deleted = true; p.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync("Project", id, "DELETED");
    }

    public async Task<List<ProjectHistoryDto>> HistoryAsync(string id, CancellationToken ct) =>
        await db.ProjectHistories.AsNoTracking().Where(h => h.ProjectId == id).OrderByDescending(h => h.CreatedAt).Select(h => new ProjectHistoryDto(h.Id, h.ChangeType, h.OldValue, h.NewValue, h.CreatedAt, h.CreatedBy)).ToListAsync(ct);

    // ------------------------------------------------------------------ allocations
    /// <summary>Peak concurrent allocation (%) of an employee inside [from, to], excluding one allocation; the rows are locked (FOR UPDATE) for the surrounding transaction.</summary>
    private async Task<decimal> CommittedAsync(string employeeId, DateOnly from, DateOnly? to, string? excludeId, CancellationToken ct)
    {
        var toBound = to ?? DateOnly.MaxValue; var ex = excludeId ?? "";
        var rows = await db.ProjectAllocations.FromSqlInterpolated(
            $"SELECT * FROM project_allocations WHERE employee_id = {employeeId} AND status = 'ACTIVE' AND start_date <= {toBound} AND (end_date IS NULL OR end_date >= {from}) AND id <> {ex} FOR UPDATE").AsNoTracking().ToListAsync(ct);
        var points = new HashSet<DateOnly> { from };
        foreach (var r in rows) points.Add(r.StartDate > from ? r.StartDate : from);   // evaluate at every start boundary inside the window
        return points.Select(pt => rows.Where(r => r.StartDate <= pt && (r.EndDate is null || r.EndDate >= pt)).Sum(r => r.AllocationPercent)).DefaultIfEmpty(0).Max();
    }

    public async Task<AllocationDto> AllocateAsync(string projectId, AllocationRequest r, CancellationToken ct)
    {
        var p = await db.Projects.AsNoTracking().FirstOrDefaultAsync(x => x.Id == projectId, ct) ?? throw new NotFoundException("Project not found");
        if (!CanManage(p)) throw new ForbiddenException("Only the project manager can allocate people");
        if (p.Status is not ("PLANNED" or "ACTIVE")) throw new BusinessRuleException($"Cannot allocate people to a {p.Status} project");
        var start = r.StartDate!.Value;
        if (start < p.StartDate || (p.EndDate is { } pe && (start > pe || (r.EndDate is { } re && re > pe)))) throw new BusinessRuleException("Allocation dates must fall within the project dates");
        var emp = await employees.SummaryAsync(r.EmployeeId, ct) ?? throw new Common.Common.ValidationException("Employee does not exist");
        if (emp.Status is not ("ACTIVE" or "ON_NOTICE")) throw new BusinessRuleException("Only active employees can be allocated");
        var endBound = r.EndDate ?? DateOnly.MaxValue;
        if (await db.ProjectAllocations.AnyAsync(a => a.ProjectId == projectId && a.EmployeeId == r.EmployeeId && a.Status == "ACTIVE" && a.StartDate <= endBound && (a.EndDate == null || a.EndDate >= start), ct))
            throw new ConflictException("Employee is already allocated to this project in that period");
        var alloc = new ProjectAllocation { ProjectId = projectId, EmployeeId = r.EmployeeId, EmployeeName = emp.FullName, Role = r.Role, AllocationPercent = r.AllocationPercent!.Value, Billable = r.Billable, StartDate = start, EndDate = r.EndDate, Status = "ACTIVE" };
        await uow.ExecuteAsync(async () =>
        {
            var committed = await CommittedAsync(r.EmployeeId, start, r.EndDate, null, ct);
            if (committed + alloc.AllocationPercent > 100) throw new BusinessRuleException($"Employee is already {committed}% allocated; adding {alloc.AllocationPercent}% would exceed 100%");
            db.ProjectAllocations.Add(alloc);
            History(projectId, "ALLOCATION_ADDED", null, $"{emp.FullName} {alloc.AllocationPercent}%");
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("ProjectAllocation", alloc.Id, "CREATED", null, new { projectId, r.EmployeeId, percent = alloc.AllocationPercent });
        }, ct);
        return ToDto(alloc);
    }

    public async Task<AllocationDto> UpdateAllocationAsync(string projectId, string allocId, AllocationUpdateRequest r, CancellationToken ct)
    {
        var p = await db.Projects.AsNoTracking().FirstOrDefaultAsync(x => x.Id == projectId, ct) ?? throw new NotFoundException("Project not found");
        if (!CanManage(p)) throw new ForbiddenException();
        var a = await db.ProjectAllocations.FirstOrDefaultAsync(x => x.Id == allocId && x.ProjectId == projectId, ct) ?? throw new NotFoundException("Allocation not found");
        if (a.Status != "ACTIVE") throw new BusinessRuleException("Ended allocations cannot be changed");
        await uow.ExecuteAsync(async () =>
        {
            var pct = r.AllocationPercent ?? a.AllocationPercent; var end = r.EndDate ?? a.EndDate;
            if (end < a.StartDate) throw new Common.Common.ValidationException("endDate must not precede startDate");
            var committed = await CommittedAsync(a.EmployeeId, a.StartDate, end, allocId, ct);
            if (committed + pct > 100) throw new BusinessRuleException($"Employee would be {committed + pct}% allocated (max 100%)");
            var old = a.AllocationPercent;
            a.Role = r.Role ?? a.Role; a.AllocationPercent = pct; a.Billable = r.Billable ?? a.Billable; a.EndDate = end;
            History(projectId, "ALLOCATION_CHANGED", $"{a.EmployeeName} {old}%", $"{pct}%");
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("ProjectAllocation", allocId, "UPDATED", null, r);
        }, ct);
        return ToDto(a);
    }

    public async Task<AllocationDto> EndAllocationAsync(string projectId, string allocId, DateOnly? endDate, CancellationToken ct)
    {
        var p = await db.Projects.AsNoTracking().FirstOrDefaultAsync(x => x.Id == projectId, ct) ?? throw new NotFoundException("Project not found");
        if (!CanManage(p)) throw new ForbiddenException();
        var a = await db.ProjectAllocations.FirstOrDefaultAsync(x => x.Id == allocId && x.ProjectId == projectId, ct) ?? throw new NotFoundException("Allocation not found");
        if (a.Status != "ACTIVE") throw new BusinessRuleException("Allocation is already ended");
        var end = endDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        if (end < a.StartDate) throw new Common.Common.ValidationException("endDate must not precede startDate");
        await uow.ExecuteAsync(async () => { a.Status = "ENDED"; a.EndDate = end; History(projectId, "ALLOCATION_ENDED", a.EmployeeName, end); await db.SaveChangesAsync(ct); await audit.WriteAsync("ProjectAllocation", allocId, "ENDED"); }, ct);
        return ToDto(a);
    }

    /// <summary>Used by the Timesheet Service: may this employee log time on this project on this date?</summary>
    public async Task<AllocationCheckDto> AllocationCheckAsync(string projectId, string employeeId, DateOnly date, CancellationToken ct)
    {
        var p = await db.Projects.AsNoTracking().FirstOrDefaultAsync(x => x.Id == projectId, ct) ?? throw new NotFoundException("Project not found");
        var a = await db.ProjectAllocations.AsNoTracking().FirstOrDefaultAsync(x => x.ProjectId == projectId && x.EmployeeId == employeeId && x.Status == "ACTIVE" && x.StartDate <= date && (x.EndDate == null || x.EndDate >= date), ct);
        return new AllocationCheckDto(projectId, p.Code, p.Status, p.ProjectManagerId, employeeId, date, a is not null && p.Status == "ACTIVE", a?.AllocationPercent ?? 0, a?.Billable ?? false);
    }

    public async Task<List<EmployeeProjectDto>> EmployeeProjectsAsync(string employeeId, CancellationToken ct)
    {
        user.EnsureSelfOr(employeeId, Perm.ProjectManage, Perm.ReportView);
        return await db.VwProjectEmployeeAllocations.AsNoTracking().Where(v => v.EmployeeId == employeeId).OrderByDescending(v => v.StartDate)
            .Select(v => new EmployeeProjectDto(v.AllocationId, v.ProjectId, v.ProjectCode, v.ProjectName, v.ProjectStatus, v.CustomerName, v.Role, v.AllocationPercent, v.Billable, v.StartDate, v.EndDate, v.AllocationStatus)).ToListAsync(ct);
    }

    /// <summary>Existing stored procedure: allocation summary of an employee on a date.</summary>
    public Task<List<Dictionary<string, object?>>> AllocationSummaryAsync(string employeeId, DateOnly? date, CancellationToken ct)
    {
        user.EnsureSelfOr(employeeId, Perm.ProjectManage, Perm.ReportView);
        return ado.CallProcedureAsync("sp_employee_allocation_summary", r => r.ToDictionary(), new { p_employee_id = employeeId, p_on_date = (date ?? DateOnly.FromDateTime(DateTime.UtcNow)).ToDateTime(TimeOnly.MinValue) }, ct);
    }

    /// <summary>Consumer path: an exiting employee's open allocations are ended automatically.</summary>
    public async Task EndAllocationsForExitAsync(string employeeId, DateOnly day, CancellationToken ct)
    {
        foreach (var a in await db.ProjectAllocations.Where(a => a.EmployeeId == employeeId && a.Status == "ACTIVE").ToListAsync(ct))
        {
            a.Status = "ENDED"; a.EndDate = a.EndDate is { } e && e < day ? e : day;
        }
        await db.SaveChangesAsync(ct);
    }
}
