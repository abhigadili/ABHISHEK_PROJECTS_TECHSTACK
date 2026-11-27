using HR.Common.Common;
using HR.Common.Http;
using HR.TaxService.DTOs;

namespace HR.TaxService.Clients;

/// <summary>Tax Service -> Payroll Service: the annual CTC is the gross income base for the TDS projection.</summary>
public interface IPayrollClient { Task<decimal?> AnnualGrossAsync(string employeeId, CancellationToken ct); }

public sealed class PayrollClient(HttpClient http) : ServiceClientBase(http), IPayrollClient
{
    public async Task<decimal?> AnnualGrossAsync(string employeeId, CancellationToken ct)
    {
        try { return (await GetAsync<PayrollEmployeeSalary>($"api/v1/payroll/salaries/employee/{employeeId}", ct))?.Summary?.AnnualCtc; }
        catch (HrException ex) when (ex.Status is System.Net.HttpStatusCode.Forbidden or System.Net.HttpStatusCode.NotFound) { return null; }
    }
}
