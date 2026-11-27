using HR.Common.Http;
using HR.OrganizationService.DTOs;

namespace HR.OrganizationService.Clients;

/// <summary>Organization Service -> Employee Service: the employee record stays authoritative for the manager assignment.</summary>
public interface IEmployeeClient
{
    Task AssignManagerAsync(string employeeId, string? managerId, CancellationToken ct);
}

public sealed class EmployeeClient(HttpClient http) : ServiceClientBase(http), IEmployeeClient
{
    public async Task AssignManagerAsync(string employeeId, string? managerId, CancellationToken ct)
    {
        var current = await GetAsync<EmployeeManagerRef>($"api/v1/employees/{employeeId}", ct) ?? throw new HR.Common.Common.NotFoundException("Employee not found");
        await PatchAsync<object>($"api/v1/employees/{employeeId}", new { managerId, version = current.Version }, ct);
    }
}
