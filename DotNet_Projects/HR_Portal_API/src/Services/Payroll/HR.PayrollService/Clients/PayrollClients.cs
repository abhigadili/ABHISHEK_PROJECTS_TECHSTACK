using HR.Common.Http;
using HR.PayrollService.DTOs;

namespace HR.PayrollService.Clients;

/// <summary>Payroll Service -> Employee Service (synchronous).</summary>
public interface IEmployeeClient { Task<List<DirectoryEntry>> ActiveEmployeesAsync(CancellationToken ct); }
public sealed class EmployeeClient(HttpClient http) : ServiceClientBase(http), IEmployeeClient
{
    public async Task<List<DirectoryEntry>> ActiveEmployeesAsync(CancellationToken ct)
    {
        var all = new List<DirectoryEntry>();
        foreach (var status in new[] { "ACTIVE", "ON_NOTICE" })
            for (var page = 1; ; page++)
            {
                var r = await GetAsync<PagedPayload<DirectoryEntry>>($"api/v1/employees?page={page}&size=200&status={status}", ct);
                if (r is null) break;
                all.AddRange(r.Items);
                if (page >= r.TotalPages) break;
            }
        return all;
    }
}

/// <summary>Payroll Service -> Attendance Service (stored-procedure backed summary).</summary>
public interface IAttendanceClient { Task<AttendanceInput> PayrollInputAsync(string employeeId, string month, CancellationToken ct); }
public sealed class AttendanceClient(HttpClient http) : ServiceClientBase(http), IAttendanceClient
{
    public async Task<AttendanceInput> PayrollInputAsync(string employeeId, string month, CancellationToken ct) =>
        await GetAsync<AttendanceInput>($"api/v1/attendance/payroll-input?employeeId={employeeId}&month={month}", ct) ?? throw new HR.Common.Common.NotFoundException("No attendance input");
}

/// <summary>Payroll Service -> Leave Service (approved paid/unpaid leave days in the month).</summary>
public interface ILeaveClient { Task<LeaveMonthly> MonthlyAsync(string employeeId, string month, CancellationToken ct); }
public sealed class LeaveClient(HttpClient http) : ServiceClientBase(http), ILeaveClient
{
    public async Task<LeaveMonthly> MonthlyAsync(string employeeId, string month, CancellationToken ct) =>
        await GetAsync<LeaveMonthly>($"api/v1/leaves/summary/{employeeId}/{month}", ct) ?? new LeaveMonthly(0, 0);
}

/// <summary>Payroll Service -> Tax Service (monthly TDS).</summary>
public interface ITaxClient { Task<decimal> MonthlyTdsAsync(string employeeId, string month, CancellationToken ct); }
public sealed class TaxClient(HttpClient http) : ServiceClientBase(http), ITaxClient
{
    public async Task<decimal> MonthlyTdsAsync(string employeeId, string month, CancellationToken ct)
    {
        try { return (await GetAsync<TdsResult>($"api/v1/tax/tds/{employeeId}/{month}", ct))?.Tds ?? 0; }
        catch (HR.Common.Common.NotFoundException) { return 0; }
    }
}
