using HR.Common.Http;

namespace HR.AttendanceService.Clients;

public sealed record HolidayItem(string Id, string Name, DateOnly HolidayDate, string Type, List<string> LocationIds, List<string> DepartmentIds);

/// <summary>Attendance Service -> Holiday Service (synchronous HTTP).</summary>
public interface IHolidayClient { Task<List<HolidayItem>> ForYearAsync(int year, CancellationToken ct); }

public sealed class HolidayClient(HttpClient http) : ServiceClientBase(http), IHolidayClient
{
    public async Task<List<HolidayItem>> ForYearAsync(int year, CancellationToken ct) => await GetAsync<List<HolidayItem>>($"api/v1/holidays?year={year}", ct) ?? [];
}
