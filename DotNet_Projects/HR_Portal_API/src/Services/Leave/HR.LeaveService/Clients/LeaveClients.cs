using HR.Common.Cache;
using HR.Common.Http;
using HR.LeaveService.DTOs;

namespace HR.LeaveService.Clients;

/// <summary>Leave Service -> Holiday Service: mandatory weekday holidays reduce the leave duration (cached 5 min).</summary>
public interface IHolidayClient { Task<int> WeekdayHolidaysAsync(DateOnly from, DateOnly to, string? locationId, string? departmentId, CancellationToken ct); }

public sealed class HolidayClient(HttpClient http, ICacheService cache) : ServiceClientBase(http), IHolidayClient
{
    public async Task<int> WeekdayHolidaysAsync(DateOnly from, DateOnly to, string? locationId, string? departmentId, CancellationToken ct)
    {
        var key = $"leave:holidays:{from:yyyyMMdd}:{to:yyyyMMdd}:{locationId}:{departmentId}";
        try
        {
            var r = await cache.GetOrCreateAsync(key, async c => await GetAsync<HolidayCount>(
                $"api/v1/holidays/count?from={from:yyyy-MM-dd}&to={to:yyyy-MM-dd}&locationId={Uri.EscapeDataString(locationId ?? "")}&departmentId={Uri.EscapeDataString(departmentId ?? "")}", c), TimeSpan.FromMinutes(5), ct);
            return r?.Count ?? 0;
        }
        catch (HR.Common.Common.HrException) { return 0; }   // holiday calendar unavailable: fall back to "no holidays" instead of blocking leave
    }
    private sealed record HolidayCount(int Count);
}

/// <summary>Leave Service -> Employee Service: fallback when the local employee read model has no row for an employee yet.</summary>
public interface IEmployeeClient { Task<EmployeeLite?> SummaryAsync(string id, CancellationToken ct); }

public sealed class EmployeeClient(HttpClient http) : ServiceClientBase(http), IEmployeeClient
{
    public async Task<EmployeeLite?> SummaryAsync(string id, CancellationToken ct)
    {
        try { return await GetAsync<EmployeeLite>($"api/v1/employees/{id}/summary", ct); } catch (HR.Common.Common.NotFoundException) { return null; }
    }
}
