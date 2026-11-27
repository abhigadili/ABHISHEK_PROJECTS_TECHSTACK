using HR.Common.Common;
using HR.Common.Http;
using HR.ProjectService.DTOs;

namespace HR.ProjectService.Clients;

/// <summary>Project Service -> Employee Service (validates project managers and allocated employees).</summary>
public interface IEmployeeClient { Task<EmployeeLite?> SummaryAsync(string id, CancellationToken ct); }

public sealed class EmployeeClient(HttpClient http) : ServiceClientBase(http), IEmployeeClient
{
    public async Task<EmployeeLite?> SummaryAsync(string id, CancellationToken ct)
    {
        try { return await GetAsync<EmployeeLite>($"api/v1/employees/{id}/summary", ct); } catch (NotFoundException) { return null; }
    }
}
