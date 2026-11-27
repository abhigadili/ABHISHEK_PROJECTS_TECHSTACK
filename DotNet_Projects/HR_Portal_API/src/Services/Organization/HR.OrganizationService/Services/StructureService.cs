using HR.Common.Cache;
using HR.Common.Common;
using HR.Common.Data;
using HR.Common.Messaging;
using HR.OrganizationService.Clients;
using HR.OrganizationService.Data;
using HR.OrganizationService.DTOs;
using HR.OrganizationService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.OrganizationService.Services;

public interface IStructureService
{
    Task<List<TreeNode>> ChartAsync(ChartQuery q, CancellationToken ct);
    Task<DepartmentEmployeesDto> DepartmentEmployeesAsync(string id, PageQuery q, CancellationToken ct);
    Task<EmployeeDetailsDto> DetailsAsync(string employeeId, CancellationToken ct);
    Task<List<ChainEntryDto>> ReportingChainAsync(string employeeId, CancellationToken ct);
    Task<List<EmployeeNodeDto>> DirectReportsAsync(string employeeId, CancellationToken ct);
    Task<List<ChainEntryDto>> SubordinatesAsync(string employeeId, CancellationToken ct);
    Task<List<ReportingLineDto>> ReportingHistoryAsync(string employeeId, CancellationToken ct);
    Task<ManagerAssignmentDto> AssignManagerAsync(string employeeId, AssignManagerRequest req, CancellationToken ct);
}

/// <summary>Organizational structure built from the employee read model (org_employee_nodes): org chart, hierarchy queries and manager assignment.</summary>
public sealed class StructureService(OrganizationDbContext db, IAdoNet ado, ICacheService cache, IEmployeeClient employees, IAuditWriter audit) : IStructureService
{
    private static EmployeeNodeDto ToDto(OrgEmployeeNode n) => new(n.EmployeeId, n.EmployeeCode, n.FullName, n.DepartmentId, n.DesignationId, n.LocationId, n.ManagerId, n.Status, n.JoiningDate);

    public async Task<List<TreeNode>> ChartAsync(ChartQuery q, CancellationToken ct) =>
        (await cache.GetOrCreateAsync($"{CacheKeys.OrgPrefix}chart:{q.Type}:{q.RootId ?? "all"}:{q.Depth}", async c =>
            q.Type == "departments" ? await DepartmentTreeAsync(q.RootId, q.Depth, c) : await ReportingTreeAsync(q.RootId, q.Depth, c), CacheKeys.Medium, ct))!.ToList();

    /// <summary>Hierarchical reporting chart assembled in memory from a single query (no N+1): lookup dictionary + parent/child linking.</summary>
    private async Task<List<TreeNode>> ReportingTreeAsync(string? rootId, int depth, CancellationToken ct)
    {
        var nodes = await db.OrgEmployeeNodes.AsNoTracking().Where(n => n.Status != "TERMINATED" && n.Status != "RESIGNED").ToListAsync(ct);
        var byId = nodes.ToDictionary(n => n.EmployeeId, n => new TreeNode { Id = n.EmployeeId, Label = n.FullName, Type = "EMPLOYEE", Code = n.EmployeeCode, DesignationId = n.DesignationId, Status = n.Status });
        var roots = new List<TreeNode>();
        foreach (var n in nodes.OrderBy(n => n.FullName))
        {
            var node = byId[n.EmployeeId];
            if (n.ManagerId is not null && byId.TryGetValue(n.ManagerId, out var parent)) parent.Children.Add(node); else roots.Add(node);
        }
        if (rootId is not null)
        {
            if (!byId.TryGetValue(rootId, out var root)) throw new NotFoundException("Employee not found in the organization chart");
            return [Prune(root, 1, depth)];
        }
        return roots.Select(r => Prune(r, 1, depth)).ToList();
    }

    private static TreeNode Prune(TreeNode t, int level, int max) => new()
    {
        Id = t.Id, Label = t.Label, Type = t.Type, Code = t.Code, DesignationId = t.DesignationId, Status = t.Status, EmployeeCount = t.EmployeeCount,
        Children = level >= max ? [] : t.Children.Select(c => Prune(c, level + 1, max)).ToList()
    };

    private async Task<List<TreeNode>> DepartmentTreeAsync(string? rootId, int depth, CancellationToken ct)
    {
        var departments = await db.Departments.AsNoTracking().Where(d => d.Active).ToListAsync(ct);
        var counts = await db.OrgEmployeeNodes.AsNoTracking().Where(n => n.DepartmentId != null && n.Status != "TERMINATED" && n.Status != "RESIGNED")
            .GroupBy(n => n.DepartmentId!).Select(g => new { Id = g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Id, x => x.Count, ct);
        var byId = departments.ToDictionary(d => d.Id, d => new TreeNode { Id = d.Id, Label = d.Name, Type = "DEPARTMENT", Code = d.Code, EmployeeCount = counts.GetValueOrDefault(d.Id) });
        var roots = new List<TreeNode>();
        foreach (var d in departments.OrderBy(d => d.Name))
            if (d.ParentId is not null && byId.TryGetValue(d.ParentId, out var p)) p.Children.Add(byId[d.Id]); else roots.Add(byId[d.Id]);
        if (rootId is not null) return byId.TryGetValue(rootId, out var r) ? [Prune(r, 1, depth)] : throw new NotFoundException("Department not found");
        return roots.Select(r => Prune(r, 1, depth)).ToList();
    }

    public async Task<DepartmentEmployeesDto> DepartmentEmployeesAsync(string id, PageQuery q, CancellationToken ct)
    {
        var dep = await db.Departments.AsNoTracking().FirstOrDefaultAsync(d => d.Id == id, ct) ?? throw new NotFoundException("Department not found");
        var query = db.OrgEmployeeNodes.AsNoTracking().Where(n => n.DepartmentId == id);
        var total = await query.LongCountAsync(ct);
        var rows = await query.OrderBy(n => n.FullName).Skip((q.Page - 1) * q.Size).Take(q.Size).ToListAsync(ct);
        return new DepartmentEmployeesDto(dep.Id, dep.Name, total, rows.Select(ToDto).ToList());
    }

    public async Task<EmployeeDetailsDto> DetailsAsync(string employeeId, CancellationToken ct)
    {
        var d = await db.VwEmployeeDepartmentDetails.AsNoTracking().FirstOrDefaultAsync(x => x.EmployeeId == employeeId, ct) ?? throw new NotFoundException("Employee not found");
        return new EmployeeDetailsDto(d.EmployeeId, d.EmployeeCode, d.FullName, d.Status, d.JoiningDate, d.DepartmentName, d.DepartmentCode, d.DesignationTitle, d.JobGradeName, d.LocationName, d.ManagerId);
    }

    // recursive CTEs run through ADO.NET (parameterised) - EF Core cannot express recursive queries
    public Task<List<ChainEntryDto>> ReportingChainAsync(string employeeId, CancellationToken ct) => ado.QueryAsync(
        """
        WITH RECURSIVE chain AS (
          SELECT employee_id, manager_id, full_name, employee_code, designation_id, 0 AS lvl FROM org_employee_nodes WHERE employee_id = @id
          UNION ALL
          SELECT n.employee_id, n.manager_id, n.full_name, n.employee_code, n.designation_id, c.lvl + 1 FROM org_employee_nodes n JOIN chain c ON n.employee_id = c.manager_id WHERE c.lvl < 50)
        SELECT lvl, employee_id, full_name, employee_code, designation_id FROM chain WHERE lvl > 0 ORDER BY lvl
        """, r => new ChainEntryDto(r.Int("lvl"), r.Str("employee_id")!, r.Str("full_name")!, r.Str("employee_code"), r.Str("designation_id")), new { id = employeeId }, ct);

    public Task<List<ChainEntryDto>> SubordinatesAsync(string employeeId, CancellationToken ct) => ado.QueryAsync(
        """
        WITH RECURSIVE tree AS (
          SELECT employee_id, manager_id, full_name, employee_code, designation_id, 1 AS lvl FROM org_employee_nodes WHERE manager_id = @id
          UNION ALL
          SELECT n.employee_id, n.manager_id, n.full_name, n.employee_code, n.designation_id, t.lvl + 1 FROM org_employee_nodes n JOIN tree t ON n.manager_id = t.employee_id WHERE t.lvl < 50)
        SELECT lvl, employee_id, full_name, employee_code, designation_id FROM tree ORDER BY lvl, full_name
        """, r => new ChainEntryDto(r.Int("lvl"), r.Str("employee_id")!, r.Str("full_name")!, r.Str("employee_code"), r.Str("designation_id")), new { id = employeeId }, ct);

    public async Task<List<EmployeeNodeDto>> DirectReportsAsync(string employeeId, CancellationToken ct) =>
        (await db.OrgEmployeeNodes.AsNoTracking().Where(n => n.ManagerId == employeeId).OrderBy(n => n.FullName).ToListAsync(ct)).Select(ToDto).ToList();

    public async Task<List<ReportingLineDto>> ReportingHistoryAsync(string employeeId, CancellationToken ct) =>
        await db.ReportingLines.AsNoTracking().Where(l => l.EmployeeId == employeeId).OrderByDescending(l => l.EffectiveFrom)
            .Select(l => new ReportingLineDto(l.Id, l.EmployeeId, l.ManagerId, l.EffectiveFrom, l.EffectiveTo)).ToListAsync(ct);

    public async Task<ManagerAssignmentDto> AssignManagerAsync(string employeeId, AssignManagerRequest req, CancellationToken ct)
    {
        if (req.ManagerId == employeeId) throw new BusinessRuleException("An employee cannot be their own manager");
        if (req.ManagerId is not null)
        {
            var hit = await ado.QueryAsync(
                """
                WITH RECURSIVE chain AS (SELECT employee_id, manager_id, 1 AS d FROM org_employee_nodes WHERE employee_id = @mgr
                  UNION ALL SELECT n.employee_id, n.manager_id, c.d + 1 FROM org_employee_nodes n JOIN chain c ON n.employee_id = c.manager_id WHERE c.d < 50)
                SELECT employee_id FROM chain WHERE employee_id = @emp
                """, r => r.GetString(0), new { mgr = req.ManagerId, emp = employeeId }, ct);
            if (hit.Count > 0) throw new BusinessRuleException("Manager assignment would create a reporting cycle");
        }
        await employees.AssignManagerAsync(employeeId, req.ManagerId, ct);   // authoritative change lives in the Employee Service
        var effective = req.EffectiveFrom ?? DateOnly.FromDateTime(DateTime.UtcNow);
        await RecordManagerChangeAsync(employeeId, req.ManagerId, effective.ToDateTime(TimeOnly.MinValue), ct);
        await audit.WriteAsync("ReportingLine", employeeId, "MANAGER_ASSIGNED", null, new { req.ManagerId, effective });
        await cache.EvictPrefixAsync(CacheKeys.OrgPrefix);
        return new ManagerAssignmentDto(employeeId, req.ManagerId, effective);
    }

    /// <summary>Closes the open reporting line and opens a new one when the manager actually changed (idempotent).</summary>
    public async Task RecordManagerChangeAsync(string employeeId, string? managerId, DateTime effectiveFrom, CancellationToken ct)
    {
        var open = await db.ReportingLines.Where(l => l.EmployeeId == employeeId && l.EffectiveTo == null).OrderByDescending(l => l.EffectiveFrom).FirstOrDefaultAsync(ct);
        if (open is not null && open.ManagerId == managerId) return;
        if (open is null && managerId is null) return;
        if (open is not null) open.EffectiveTo = effectiveFrom;
        db.ReportingLines.Add(new ReportingLine { EmployeeId = employeeId, ManagerId = managerId, EffectiveFrom = effectiveFrom });
        await db.SaveChangesAsync(ct);
    }
}

/// <summary>Read model: org_employee_nodes follows employee lifecycle events; reporting history is recorded on manager change.</summary>
public sealed class OrgEmployeeReadModel(OrganizationDbContext db, IStructureService structure, ICacheService cache) : IEmployeeReadModel
{
    public async Task UpsertAsync(EmployeeEvent e, CancellationToken ct)
    {
        var node = await db.OrgEmployeeNodes.FirstOrDefaultAsync(n => n.EmployeeId == e.EmployeeId, ct);
        if (node is null) { node = new OrgEmployeeNode { EmployeeId = e.EmployeeId }; db.OrgEmployeeNodes.Add(node); }
        node.EmployeeCode = e.EmployeeCode; node.FullName = e.FullName; node.Email = e.WorkEmail; node.DepartmentId = e.DepartmentId; node.DesignationId = e.DesignationId;
        node.LocationId = e.LocationId; node.ManagerId = e.ManagerId; node.JoiningDate = e.JoiningDate; node.Status = e.Status;
        await db.SaveChangesAsync(ct);
        await ((StructureService)structure).RecordManagerChangeAsync(e.EmployeeId, e.ManagerId, e.OccurredAt.UtcDateTime, ct);
        await cache.EvictPrefixAsync(CacheKeys.OrgPrefix);
    }
}
