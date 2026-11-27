using HR.Common.Cache;
using HR.Common.Common;
using HR.Common.Crud;
using HR.Common.Data;
using HR.Common.Messaging;
using HR.LeaveService.Data;
using HR.LeaveService.DTOs;
using HR.LeaveService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.LeaveService.Services;

public sealed class LeaveTypeService(LeaveDbContext db, IAuditWriter audit, ICacheService cache) : CrudService<LeaveType, LeaveTypeRequest, LeaveTypeDto>(db, audit, cache)
{
    protected override string Label => "LeaveType";
    protected override string[] SortFields => ["Code", "Name"];
    protected override string DefaultSort => "Code";
    protected override string[] SearchFields => ["Name", "Code"];
    protected override string? CachePrefix => CacheKeys.ReferenceData;
    protected override async Task BeforeCreateAsync(LeaveType e, LeaveTypeRequest r, CancellationToken ct)
    {
        if (await db.LeaveTypes.IgnoreQueryFilters().AnyAsync(t => t.Code == e.Code, ct)) throw new ConflictException("Leave type code already exists");
    }
    protected override async Task BeforeUpdateAsync(LeaveType e, LeaveTypeRequest r, CancellationToken ct)
    {
        if (await db.LeaveTypes.IgnoreQueryFilters().AnyAsync(t => t.Code == e.Code && t.Id != e.Id, ct)) throw new ConflictException("Leave type code already exists");
    }
    protected override async Task BeforeDeleteAsync(LeaveType e, CancellationToken ct)
    {
        if (await db.LeaveApplications.AnyAsync(a => a.LeaveTypeId == e.Id, ct)) throw new BusinessRuleException("Leave type has applications; deactivate it instead");
    }
}

public interface IPolicyService
{
    Task<List<PolicyDto>> ListAsync(CancellationToken ct);
    Task<PolicyDto> GetAsync(string id, CancellationToken ct);
    Task<PolicyDto> CreateAsync(PolicyRequest r, CancellationToken ct);
    Task<PolicyDto> UpdateAsync(string id, PolicyUpdateRequest r, CancellationToken ct);
    Task DeleteAsync(string id, CancellationToken ct);
}

public sealed class PolicyService(LeaveDbContext db, IAuditWriter audit, IUnitOfWork uow) : IPolicyService
{
    private async Task<List<PolicyDto>> ToDtosAsync(List<LeavePolicy> policies, CancellationToken ct)
    {
        var ids = policies.Select(p => p.Id).ToList();
        var ents = await (from e in db.LeavePolicyEntitlements.AsNoTracking()
                          join t in db.LeaveTypes.IgnoreQueryFilters() on e.LeaveTypeId equals t.Id
                          where ids.Contains(e.PolicyId) orderby t.Code
                          select new { e.PolicyId, Dto = new EntitlementDto(e.LeaveTypeId, t.Code, t.Name, e.AnnualDays, e.AccrualPerMonth, e.CarryForwardMax, e.Encashable, e.EncashmentMaxDays) }).ToListAsync(ct);
        var lookup = ents.ToLookup(x => x.PolicyId, x => x.Dto);
        return policies.Select(p => new PolicyDto(p.Id, p.Name, p.Description, p.HrApprovalThresholdDays, p.IsDefault, p.Active, lookup[p.Id].ToList())).ToList();
    }

    public async Task<List<PolicyDto>> ListAsync(CancellationToken ct) => await ToDtosAsync(await db.LeavePolicies.AsNoTracking().OrderBy(p => p.Name).ToListAsync(ct), ct);

    public async Task<PolicyDto> GetAsync(string id, CancellationToken ct)
    {
        var p = await db.LeavePolicies.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Leave policy not found");
        return (await ToDtosAsync([p], ct))[0];
    }

    // leave_policy_entitlements uses a composite key (leave_type_id, policy_id): replace-all semantics inside one transaction
    private async Task ReplaceEntitlementsAsync(string policyId, List<EntitlementRequest> items, CancellationToken ct)
    {
        var existing = await db.LeavePolicyEntitlements.Where(e => e.PolicyId == policyId).ToListAsync(ct);
        db.LeavePolicyEntitlements.RemoveRange(existing);
        await db.SaveChangesAsync(ct);
        var typeIds = items.Select(i => i.LeaveTypeId).Distinct().ToList();
        if (await db.LeaveTypes.CountAsync(t => typeIds.Contains(t.Id), ct) != typeIds.Count) throw new Common.Common.ValidationException("One or more leave types do not exist");
        foreach (var i in items)
            db.LeavePolicyEntitlements.Add(new LeavePolicyEntitlement { PolicyId = policyId, LeaveTypeId = i.LeaveTypeId, AnnualDays = i.AnnualDays, AccrualPerMonth = i.AccrualPerMonth,
                CarryForwardMax = i.CarryForwardMax, Encashable = i.Encashable, EncashmentMaxDays = i.EncashmentMaxDays, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync(ct);
    }

    private Task ClearDefaultAsync(CancellationToken ct) => db.Database.ExecuteSqlRawAsync("UPDATE leave_policies SET is_default = 0", ct);

    public async Task<PolicyDto> CreateAsync(PolicyRequest r, CancellationToken ct)
    {
        var p = new LeavePolicy { Name = r.Name, Description = r.Description, HrApprovalThresholdDays = r.HrApprovalThresholdDays, IsDefault = r.IsDefault, Active = r.Active };
        await uow.ExecuteAsync(async () =>
        {
            if (r.IsDefault) await ClearDefaultAsync(ct);
            db.LeavePolicies.Add(p);
            await db.SaveChangesAsync(ct);
            await ReplaceEntitlementsAsync(p.Id, r.Entitlements, ct);
            await audit.WriteAsync("LeavePolicy", p.Id, "CREATED", null, r);
        }, ct);
        return await GetAsync(p.Id, ct);
    }

    public async Task<PolicyDto> UpdateAsync(string id, PolicyUpdateRequest r, CancellationToken ct)
    {
        var p = await db.LeavePolicies.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Leave policy not found");
        var before = await GetAsync(id, ct);
        await uow.ExecuteAsync(async () =>
        {
            if (r.IsDefault == true) await ClearDefaultAsync(ct);
            db.Entry(p).State = EntityState.Unchanged;
            p.Name = r.Name ?? p.Name; p.Description = r.Description ?? p.Description; p.HrApprovalThresholdDays = r.HrApprovalThresholdDays ?? p.HrApprovalThresholdDays;
            if (r.IsDefault is { } d) p.IsDefault = d;
            if (r.Active is { } a) p.Active = a;
            await db.SaveChangesAsync(ct);
            if (r.Entitlements is not null) await ReplaceEntitlementsAsync(id, r.Entitlements, ct);
            await audit.WriteAsync("LeavePolicy", id, "UPDATED", before, r);
        }, ct);
        return await GetAsync(id, ct);
    }

    public async Task DeleteAsync(string id, CancellationToken ct)
    {
        var p = await db.LeavePolicies.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Leave policy not found");
        if (p.IsDefault) throw new BusinessRuleException("The default policy cannot be deleted");
        p.Deleted = true; p.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }
}

/// <summary>Read model: leave_employees follows employee events; leave balances are created for newly onboarded employees.</summary>
public sealed class LeaveEmployeeReadModel(LeaveDbContext db, IBalanceService balances) : IEmployeeReadModel
{
    public async Task UpsertAsync(EmployeeEvent e, CancellationToken ct)
    {
        var row = await db.LeaveEmployees.FirstOrDefaultAsync(x => x.EmployeeId == e.EmployeeId, ct);
        if (row is null) { row = new LeaveEmployee { EmployeeId = e.EmployeeId }; db.LeaveEmployees.Add(row); }
        row.DepartmentId = e.DepartmentId; row.FullName = e.FullName; row.Gender = e.Gender; row.JoiningDate = e.JoiningDate; row.LocationId = e.LocationId; row.ManagerId = e.ManagerId;
        row.Status = e.Status; row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        if (e.ChangeType == "CREATED") await balances.InitialiseAsync(e.EmployeeId, e.JoiningDate, DateTime.UtcNow.Year, ct);
        await balances.EvictAsync(e.EmployeeId);
    }
}
