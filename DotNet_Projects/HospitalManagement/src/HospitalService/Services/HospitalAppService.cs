using HMS.Hospitals.Domain;
using HMS.Hospitals.Dtos;
using HMS.Shared.Cache;
using HMS.Shared.Common;
using HMS.Shared.Data;
using Microsoft.EntityFrameworkCore;

namespace HMS.Hospitals.Services;

public interface IHospitalAppService
{
    Task<HospitalResponse> CreateAsync(HospitalRequest r, CancellationToken ct);
    Task<List<HospitalResponse>> ListAsync(CancellationToken ct);
    Task<HospitalResponse> GetAsync(long id, CancellationToken ct);
    Task<HospitalResponse> UpdateAsync(long id, HospitalRequest r, CancellationToken ct);
    Task DeactivateAsync(long id, CancellationToken ct);
    Task<List<DepartmentResponse>> DepartmentsAsync(long hospitalId, CancellationToken ct);
    Task<DepartmentResponse> AddDepartmentAsync(long hospitalId, DepartmentRequest r, CancellationToken ct);
    Task<DepartmentResponse> DepartmentAsync(long id, CancellationToken ct);
    Task<DepartmentResponse> UpdateDepartmentAsync(long id, DepartmentRequest r, CancellationToken ct);
    Task DeactivateDepartmentAsync(long id, CancellationToken ct);
}

/// <summary>Hospital + department master data. Reads are cached in Redis; every write updates/evicts the affected entries.</summary>
public sealed class HospitalAppService(IRepository<Hospital> hospitals, IRepository<Department> departments, ICacheService cache, IConfiguration cfg) : IHospitalAppService
{
    private TimeSpan Ttl => TimeSpan.FromMinutes(cfg.GetValue("Cache:HospitalMinutes", 30));
    private static string HKey(long id) => $"hospital:{id}";
    private static string DKey(long hospitalId) => $"hospital-departments:{hospitalId}";

    public async Task<HospitalResponse> CreateAsync(HospitalRequest r, CancellationToken ct)
    {
        if (await hospitals.AnyAsync(h => h.Code == r.Code, ct)) throw new ConflictException($"Hospital code '{r.Code}' already exists");
        var h = new Hospital();
        Apply(h, r);
        await hospitals.AddAsync(h, ct);
        await hospitals.SaveAsync(ct);
        return HospitalResponse.From(h);
    }

    public async Task<List<HospitalResponse>> ListAsync(CancellationToken ct) =>
        (await hospitals.Query().AsNoTracking().OrderBy(h => h.Name).ToListAsync(ct)).Select(HospitalResponse.From).ToList();

    public async Task<HospitalResponse> GetAsync(long id, CancellationToken ct) =>
        await cache.GetOrCreateAsync(HKey(id), async t => (await hospitals.Query().AsNoTracking().FirstOrDefaultAsync(h => h.Id == id, t)) is { } h ? HospitalResponse.From(h) : null, Ttl, ct)
        ?? throw new NotFoundException($"Hospital {id} not found");

    public async Task<HospitalResponse> UpdateAsync(long id, HospitalRequest r, CancellationToken ct)
    {
        var h = await hospitals.GetAsync(id, ct) ?? throw new NotFoundException($"Hospital {id} not found");
        if (h.Code != r.Code && await hospitals.AnyAsync(x => x.Code == r.Code, ct)) throw new ConflictException($"Hospital code '{r.Code}' already exists");
        Apply(h, r);
        await hospitals.SaveAsync(ct);
        var dto = HospitalResponse.From(h);
        await cache.SetAsync(HKey(id), dto, Ttl, ct);   // cache update (write-through)
        return dto;
    }

    public async Task DeactivateAsync(long id, CancellationToken ct)
    {
        var h = await hospitals.GetAsync(id, ct) ?? throw new NotFoundException($"Hospital {id} not found");
        h.Active = false;
        await hospitals.SaveAsync(ct);
        await cache.RemoveAsync(HKey(id), ct);
    }

    public async Task<List<DepartmentResponse>> DepartmentsAsync(long hospitalId, CancellationToken ct)
    {
        await GetAsync(hospitalId, ct);
        var cached = await cache.GetOrCreateAsync(DKey(hospitalId), async t =>
            new DepartmentList((await departments.Query().AsNoTracking().Where(d => d.HospitalId == hospitalId).OrderBy(d => d.Name).ToListAsync(t)).Select(DepartmentResponse.From).ToList()), Ttl, ct);
        return cached!.Items;
    }

    public async Task<DepartmentResponse> AddDepartmentAsync(long hospitalId, DepartmentRequest r, CancellationToken ct)
    {
        if (!await hospitals.AnyAsync(h => h.Id == hospitalId, ct)) throw new NotFoundException($"Hospital {hospitalId} not found");
        if (await departments.AnyAsync(d => d.HospitalId == hospitalId && d.Name == r.Name, ct)) throw new ConflictException($"Department '{r.Name}' already exists in this hospital");
        var d = new Department { HospitalId = hospitalId, Name = r.Name, Description = r.Description };
        await departments.AddAsync(d, ct);
        await departments.SaveAsync(ct);
        await cache.RemoveAsync(DKey(hospitalId), ct);
        return DepartmentResponse.From(d);
    }

    public async Task<DepartmentResponse> DepartmentAsync(long id, CancellationToken ct) =>
        DepartmentResponse.From(await departments.GetAsync(id, ct) ?? throw new NotFoundException($"Department {id} not found"));

    public async Task<DepartmentResponse> UpdateDepartmentAsync(long id, DepartmentRequest r, CancellationToken ct)
    {
        var d = await departments.GetAsync(id, ct) ?? throw new NotFoundException($"Department {id} not found");
        d.Name = r.Name;
        d.Description = r.Description;
        await departments.SaveAsync(ct);
        await cache.RemoveAsync(DKey(d.HospitalId), ct);
        return DepartmentResponse.From(d);
    }

    public async Task DeactivateDepartmentAsync(long id, CancellationToken ct)
    {
        var d = await departments.GetAsync(id, ct) ?? throw new NotFoundException($"Department {id} not found");
        d.Active = false;
        await departments.SaveAsync(ct);
        await cache.RemoveAsync(DKey(d.HospitalId), ct);
    }

    private static void Apply(Hospital h, HospitalRequest r)
    {
        h.Name = r.Name; h.Code = r.Code; h.Address = r.Address; h.City = r.City; h.Phone = r.Phone; h.Email = r.Email;
    }

    public sealed record DepartmentList(List<DepartmentResponse> Items);
}
