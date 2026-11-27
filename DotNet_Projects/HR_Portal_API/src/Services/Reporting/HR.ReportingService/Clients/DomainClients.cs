using HR.Common.Http;
using HR.ReportingService.DTOs;

namespace HR.ReportingService.Clients;

public interface IPayrollApi { Task<List<RunLite>> RunsAsync(string month, CancellationToken ct); Task<object?> RunReportAsync(string runId, CancellationToken ct); }
public interface IProjectApi { Task<List<ProjectLite>> ListAsync(string? status, CancellationToken ct); Task<ProjectDetailLite?> GetAsync(string id, CancellationToken ct); }
public interface IPerformanceApi { Task<object?> CycleReportAsync(string cycleId, CancellationToken ct); }

/// <summary>Reporting Service -> data owners (Payroll, Project, Performance) over synchronous HTTP; the caller's token is forwarded so their permissions apply.</summary>
public sealed class PayrollApi(HttpClient http) : ServiceClientBase(http), IPayrollApi
{
    public async Task<List<RunLite>> RunsAsync(string month, CancellationToken ct) =>
        (await GetAsync<RunPage>("api/v1/payroll/runs?size=100&sort=PayrollMonth", ct))?.Items.Where(r => r.PayrollMonth == month).ToList() ?? [];
    public Task<object?> RunReportAsync(string runId, CancellationToken ct) => GetAsync<object>($"api/v1/payroll/runs/{runId}/report", ct)!;
}

public sealed class ProjectApi(HttpClient http) : ServiceClientBase(http), IProjectApi
{
    public async Task<List<ProjectLite>> ListAsync(string? status, CancellationToken ct) =>
        (await GetAsync<ProjectPage>($"api/v1/projects?size=100{(status is null ? "" : "&status=" + status)}", ct))?.Items ?? [];
    public Task<ProjectDetailLite?> GetAsync(string id, CancellationToken ct) => GetAsync<ProjectDetailLite>($"api/v1/projects/{id}", ct);
}

public sealed class PerformanceApi(HttpClient http) : ServiceClientBase(http), IPerformanceApi
{
    public Task<object?> CycleReportAsync(string cycleId, CancellationToken ct) => GetAsync<object>($"api/v1/performance/cycles/{cycleId}/report", ct)!;
}
