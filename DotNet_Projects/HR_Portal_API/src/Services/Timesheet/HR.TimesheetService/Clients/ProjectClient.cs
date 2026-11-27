using HR.Common.Http;
using HR.TimesheetService.DTOs;

namespace HR.TimesheetService.Clients;

/// <summary>Timesheet Service -> Project Service: validates employee allocation before accepting time entries.</summary>
public interface IProjectClient { Task<AllocationCheck> CheckAsync(string projectId, string employeeId, DateOnly date, CancellationToken ct); }

public sealed class ProjectClient(HttpClient http) : ServiceClientBase(http), IProjectClient
{
    public async Task<AllocationCheck> CheckAsync(string projectId, string employeeId, DateOnly date, CancellationToken ct) =>
        await GetAsync<AllocationCheck>($"api/v1/projects/{projectId}/allocation-check?employeeId={employeeId}&date={date:yyyy-MM-dd}", ct) ?? throw new HR.Common.Common.NotFoundException("Project not found");
}
