using HR.Common.Cache;
using HR.Common.Common;
using HR.Common.Http;
using HR.EmployeeService.DTOs;

namespace HR.EmployeeService.Clients;

/// <summary>Employee Service -> Organization Service (synchronous HTTP). Reference data is cached in Redis (cache-aside).</summary>
public interface IOrganizationClient
{
    Task<OrgRef?> DepartmentAsync(string id, CancellationToken ct = default);
    Task<OrgRef?> DesignationAsync(string id, CancellationToken ct = default);
    Task<OrgRef?> LocationAsync(string id, CancellationToken ct = default);
}

public sealed class OrganizationClient(HttpClient http, ICacheService cache) : ServiceClientBase(http), IOrganizationClient
{
    public Task<OrgRef?> DepartmentAsync(string id, CancellationToken ct = default) => Lookup("departments", id, ct);
    public Task<OrgRef?> DesignationAsync(string id, CancellationToken ct = default) =>
        cache.GetOrCreateAsync($"{CacheKeys.ReferenceData}designations:{id}", async c =>
        {
            try { var d = await GetAsync<DesignationLite>($"api/v1/organization/designations/{id}", c); return d is null ? null : new OrgRef(d.Id, d.Code, d.Title); }
            catch (NotFoundException) { return null; }
        }, CacheKeys.Medium, ct);
    public Task<OrgRef?> LocationAsync(string id, CancellationToken ct = default) => Lookup("locations", id, ct);

    private Task<OrgRef?> Lookup(string kind, string id, CancellationToken ct) =>
        cache.GetOrCreateAsync($"{CacheKeys.ReferenceData}{kind}:{id}", async c =>
        {
            try { return await GetAsync<OrgRef>($"api/v1/organization/{kind}/{id}", c); }
            catch (NotFoundException) { return null; }
        }, CacheKeys.Medium, ct);

    private sealed record DesignationLite(string Id, string? Code, string? Title);
}
