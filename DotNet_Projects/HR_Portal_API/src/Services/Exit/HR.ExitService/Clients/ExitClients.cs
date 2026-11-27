using HR.Common.Common;
using HR.Common.Http;
using HR.ExitService.DTOs;

namespace HR.ExitService.Clients;

/// <summary>Exit Service -> Employee Service.</summary>
public interface IEmployeeClient { Task<EmployeeInfo> SummaryAsync(string id, CancellationToken ct); }
public sealed class EmployeeClient(HttpClient http) : ServiceClientBase(http), IEmployeeClient
{
    public async Task<EmployeeInfo> SummaryAsync(string id, CancellationToken ct) => await GetAsync<EmployeeInfo>($"api/v1/employees/{id}/summary", ct) ?? throw new NotFoundException("Employee not found");
}

/// <summary>Exit Service -> Payroll Service: salary basis for the settlement and posting the final settlement into payroll.</summary>
public interface IPayrollClient
{
    Task<SettlementBasis?> BasisAsync(string employeeId, CancellationToken ct);
    Task PostSettlementAsync(string employeeId, decimal amount, string month, string referenceId, string description, CancellationToken ct);
}
public sealed class PayrollClient(HttpClient http) : ServiceClientBase(http), IPayrollClient
{
    public async Task<SettlementBasis?> BasisAsync(string employeeId, CancellationToken ct)
    {
        try { return await GetAsync<SettlementBasis>($"api/v1/payroll/settlement-basis/{employeeId}", ct); } catch (NotFoundException) { return null; }
    }
    public async Task PostSettlementAsync(string employeeId, decimal amount, string month, string referenceId, string description, CancellationToken ct) =>
        await PostAsync<object>("api/v1/payroll/settlements", new { employeeId, amount, month, referenceId, description }, ct);
}
