using HR.Common.Cache;
using HR.Common.Common;
using HR.Common.Crud;
using HR.Common.Data;
using HR.OrganizationService.Data;
using HR.OrganizationService.DTOs;
using HR.OrganizationService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.OrganizationService.Services;

// Reference data of the organization: each class only adds its own business rules to the generic CrudService.

public sealed class OrganizationRefService(OrganizationDbContext db, IAuditWriter audit, ICacheService cache) : CrudService<Organization, OrganizationRequest, OrganizationDto>(db, audit, cache)
{
    protected override string Label => "Organization";
    protected override string[] SortFields => ["Name", "CreatedAt"];
    protected override string DefaultSort => "Name";
    protected override string[] SearchFields => ["Name", "LegalName"];
    protected override string? CachePrefix => CacheKeys.OrgPrefix;
}

public sealed class BusinessUnitService(OrganizationDbContext db, IAuditWriter audit, ICacheService cache) : CrudService<BusinessUnit, BusinessUnitRequest, BusinessUnitDto>(db, audit, cache)
{
    protected override string Label => "BusinessUnit";
    protected override string[] SortFields => ["Name", "Code", "CreatedAt"];
    protected override string DefaultSort => "Name";
    protected override string[] SearchFields => ["Name", "Code"];
    protected override string? CachePrefix => CacheKeys.OrgPrefix;
    protected override async Task BeforeCreateAsync(BusinessUnit e, BusinessUnitRequest r, CancellationToken ct)
    {
        if (!await db.Organizations.AnyAsync(o => o.Id == e.OrganizationId, ct)) throw new Common.Common.ValidationException("Unknown organization", ["organizationId"]);
        if (await db.BusinessUnits.AnyAsync(b => b.Code == e.Code, ct)) throw new ConflictException($"Business unit code '{e.Code}' already exists");
    }
}

public sealed class DepartmentService(OrganizationDbContext db, IAuditWriter audit, ICacheService cache) : CrudService<Department, DepartmentRequest, DepartmentDto>(db, audit, cache)
{
    protected override string Label => "Department";
    protected override string[] SortFields => ["Name", "Code", "CreatedAt"];
    protected override string DefaultSort => "Name";
    protected override string[] SearchFields => ["Name", "Code"];
    protected override string? CachePrefix => CacheKeys.OrgPrefix;

    protected override async Task BeforeCreateAsync(Department e, DepartmentRequest r, CancellationToken ct)
    {
        if (await db.Departments.AnyAsync(d => d.Code == e.Code, ct)) throw new ConflictException($"Department code '{e.Code}' already exists");
        await ValidateLinksAsync(e, null, ct);
    }

    protected override async Task BeforeUpdateAsync(Department e, DepartmentRequest r, CancellationToken ct)
    {
        if (await db.Departments.AnyAsync(d => d.Code == e.Code && d.Id != e.Id, ct)) throw new ConflictException($"Department code '{e.Code}' already exists");
        await ValidateLinksAsync(e, e.Id, ct);
    }

    private async Task ValidateLinksAsync(Department e, string? selfId, CancellationToken ct)
    {
        if (e.BusinessUnitId is not null && !await db.BusinessUnits.AnyAsync(b => b.Id == e.BusinessUnitId, ct)) throw new Common.Common.ValidationException("Unknown business unit", ["businessUnitId"]);
        if (e.ParentId is null) return;
        if (e.ParentId == selfId) throw new BusinessRuleException("A department cannot be its own parent");
        // walk the proposed parent chain upward: reaching this department would create a cycle
        var cursor = e.ParentId;
        for (var depth = 0; cursor is not null && depth < 50; depth++)
        {
            var parent = await db.Departments.AsNoTracking().Where(d => d.Id == cursor).Select(d => new { d.Id, d.ParentId }).FirstOrDefaultAsync(ct)
                         ?? throw new Common.Common.ValidationException("Unknown parent department", ["parentId"]);
            if (parent.ParentId == selfId && selfId is not null) throw new BusinessRuleException("Parent assignment would create a department cycle");
            cursor = parent.ParentId;
        }
    }

    protected override async Task BeforeDeleteAsync(Department e, CancellationToken ct)
    {
        if (await db.Departments.AnyAsync(d => d.ParentId == e.Id, ct)) throw new BusinessRuleException("Department has sub-departments");
        if (await db.OrgEmployeeNodes.AnyAsync(n => n.DepartmentId == e.Id && n.Status != "TERMINATED" && n.Status != "RESIGNED", ct)) throw new BusinessRuleException("Department still has employees");
    }
}

public sealed class DesignationService(OrganizationDbContext db, IAuditWriter audit, ICacheService cache) : CrudService<Designation, DesignationRequest, DesignationDto>(db, audit, cache)
{
    protected override string Label => "Designation";
    protected override string[] SortFields => ["Title", "Code", "CreatedAt"];
    protected override string DefaultSort => "Title";
    protected override string[] SearchFields => ["Title", "Code"];
    protected override string? CachePrefix => CacheKeys.OrgPrefix;
    protected override async Task BeforeCreateAsync(Designation e, DesignationRequest r, CancellationToken ct)
    {
        if (await db.Designations.AnyAsync(d => d.Code == e.Code, ct)) throw new ConflictException($"Designation code '{e.Code}' already exists");
        if (e.JobGradeId is not null && !await db.JobGrades.AnyAsync(g => g.Id == e.JobGradeId, ct)) throw new Common.Common.ValidationException("Unknown job grade", ["jobGradeId"]);
    }
    protected override async Task BeforeDeleteAsync(Designation e, CancellationToken ct)
    {
        if (await db.OrgEmployeeNodes.AnyAsync(n => n.DesignationId == e.Id, ct)) throw new BusinessRuleException("Designation is in use by employees");
    }
}

public sealed class JobGradeService(OrganizationDbContext db, IAuditWriter audit, ICacheService cache) : CrudService<JobGrade, JobGradeRequest, JobGradeDto>(db, audit, cache)
{
    protected override string Label => "JobGrade";
    protected override string[] SortFields => ["GradeLevel", "Name", "Code"];
    protected override string DefaultSort => "GradeLevel";
    protected override string[] SearchFields => ["Name", "Code"];
    protected override string? CachePrefix => CacheKeys.OrgPrefix;
    protected override async Task BeforeCreateAsync(JobGrade e, JobGradeRequest r, CancellationToken ct)
    {
        if (await db.JobGrades.AnyAsync(g => g.Code == e.Code, ct)) throw new ConflictException($"Job grade code '{e.Code}' already exists");
        Check(e);
    }
    protected override Task BeforeUpdateAsync(JobGrade e, JobGradeRequest r, CancellationToken ct) { Check(e); return Task.CompletedTask; }
    private static void Check(JobGrade e) { if (e.MinSalary is { } min && e.MaxSalary is { } max && min > max) throw new Common.Common.ValidationException("minSalary must not exceed maxSalary"); }
}

public sealed class LocationService(OrganizationDbContext db, IAuditWriter audit, ICacheService cache) : CrudService<Location, LocationRequest, LocationDto>(db, audit, cache)
{
    protected override string Label => "Location";
    protected override string[] SortFields => ["Name", "Code", "City"];
    protected override string DefaultSort => "Name";
    protected override string[] SearchFields => ["Name", "Code", "City"];
    protected override string? CachePrefix => CacheKeys.OrgPrefix;
    protected override async Task BeforeCreateAsync(Location e, LocationRequest r, CancellationToken ct)
    {
        if (await db.Locations.AnyAsync(l => l.Code == e.Code, ct)) throw new ConflictException($"Location code '{e.Code}' already exists");
    }
    protected override async Task BeforeDeleteAsync(Location e, CancellationToken ct)
    {
        if (await db.OrgEmployeeNodes.AnyAsync(n => n.LocationId == e.Id, ct)) throw new BusinessRuleException("Location is in use by employees");
    }
}
