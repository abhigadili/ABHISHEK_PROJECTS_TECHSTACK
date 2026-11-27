using Polly;
using System.Text.Json;
using System.Text.Json.Nodes;
using HR.Common.Http;
using HR.Common.Security;
using Microsoft.Extensions.Http.Resilience;

namespace HR.ApiGateway.Dashboard;

public interface IDashboardService
{
    Task<JsonObject> EmployeeAsync(CancellationToken ct);
    Task<JsonObject> ManagerAsync(CancellationToken ct);
}

public static class DashboardRegistration
{
    public static readonly string[] Services = ["Employee", "Leave", "Holiday", "Attendance", "Timesheet", "Payroll", "Performance", "Project", "Organization"];
    private static readonly int[] Ports = [32102, 32104, 32106, 32105, 32111, 32107, 32109, 32110, 32103];

    /// <summary>Named HttpClients (one per upstream service) with header propagation and a short timeout/retry pipeline.</summary>
    public static IServiceCollection AddDashboardClients(this IServiceCollection services, IConfiguration cfg)
    {
        services.AddTransient<HeaderPropagationHandler>();
        for (var i = 0; i < Services.Length; i++)
        {
            var url = cfg[$"Services:{Services[i]}"] ?? $"http://localhost:{Ports[i]}";
            services.AddHttpClient(Services[i], c => { c.BaseAddress = new Uri(url.TrimEnd('/') + "/"); c.Timeout = TimeSpan.FromSeconds(20); })
                .AddHttpMessageHandler<HeaderPropagationHandler>()
                .AddResilienceHandler("dashboard", p => { p.AddTimeout(TimeSpan.FromSeconds(6)); p.AddRetry(new HttpRetryStrategyOptions { MaxRetryAttempts = 1, Delay = TimeSpan.FromMilliseconds(150) }); });
        }
        return services;
    }
}

/// <summary>
/// Aggregation APIs (the gateway composes upstream responses): every independent upstream call runs concurrently through Task.WhenAll;
/// a failing section is reported in "unavailable" instead of failing the whole dashboard.
/// </summary>
public sealed class DashboardService(IHttpClientFactory factory, ICurrentUser user, ILogger<DashboardService> log) : IDashboardService
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>GET an upstream endpoint and return the "data" node of the standard envelope.</summary>
    private async Task<JsonNode?> GetAsync(string service, string path, CancellationToken ct)
    {
        using var res = await factory.CreateClient(service).GetAsync(path, ct);
        if (!res.IsSuccessStatusCode) throw new HttpRequestException($"{service} {path} -> {(int)res.StatusCode}");
        if (res.StatusCode == System.Net.HttpStatusCode.NoContent) return null;   // "nothing yet" (e.g. no active review)
        var node = await JsonNode.ParseAsync(await res.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
        return node?["data"]?.DeepClone();
    }

    private async Task<(string Name, JsonNode? Data, bool Ok)> SectionAsync(string name, Func<Task<JsonNode?>> load)
    {
        try { return (name, await load(), true); }
        catch (Exception ex) when (ex is not OperationCanceledException) { log.LogWarning("Dashboard section {Section} unavailable: {Error}", name, ex.Message); return (name, null, false); }
    }

    private static JsonObject Assemble(IEnumerable<(string Name, JsonNode? Data, bool Ok)> sections, JsonObject target)
    {
        var unavailable = new JsonArray();
        foreach (var s in sections) { target[s.Name] = s.Data; if (!s.Ok) unavailable.Add(s.Name); }
        target["generatedAt"] = DateTimeOffset.UtcNow.ToString("O");
        target["unavailable"] = unavailable;
        return target;
    }

    public async Task<JsonObject> EmployeeAsync(CancellationToken ct)
    {
        if (user.EmployeeId is null) return new JsonObject { ["message"] = "Your account is not linked to an employee", ["unavailable"] = new JsonArray() };
        var month = DateTime.UtcNow.ToString("yyyy-MM");
        // the profile first: the holiday calendar depends on the employee's location / department
        var profile = (await SectionAsync("profile", () => GetAsync("Employee", "api/v1/employees/me", ct)));
        var loc = profile.Data?["locationId"]?.GetValue<string>(); var dep = profile.Data?["departmentId"]?.GetValue<string>();
        var canApprove = user.HasAnyPermission(Perm.LeaveApprove, Perm.TimesheetApprove, Perm.AttendanceApprove);

        var tasks = new List<Task<(string, JsonNode?, bool)>>
        {
            SectionAsync("leaveBalance", () => GetAsync("Leave", "api/v1/leaves/balances/me", ct)),
            SectionAsync("upcomingHolidays", () => GetAsync("Holiday", $"api/v1/holidays/upcoming?limit=5&locationId={loc}&departmentId={dep}", ct)),
            SectionAsync("attendanceToday", () => GetAsync("Attendance", "api/v1/attendance/today", ct)),
            SectionAsync("attendanceSummary", async () => (await GetAsync("Attendance", $"api/v1/attendance/monthly?month={month}", ct))?["summary"]?.DeepClone()),
            SectionAsync("recentTimesheets", async () => (await GetAsync("Timesheet", "api/v1/timesheets?size=3&sort=WeekStart&dir=desc", ct))?["items"]?.DeepClone()),
            SectionAsync("latestPayslip", () => GetAsync("Payroll", "api/v1/payroll/payslips/me/latest", ct)),
            SectionAsync("pendingApprovals", async () =>
            {
                if (!canApprove) return null;
                var leave = user.HasPermission(Perm.LeaveApprove) ? SafeCount("Leave", "api/v1/leaves/pending-approvals", ct) : Task.FromResult<int?>(0);
                var ts = user.HasPermission(Perm.TimesheetApprove) ? SafeCount("Timesheet", "api/v1/timesheets/pending-approvals", ct) : Task.FromResult<int?>(0);
                await Task.WhenAll(leave, ts);
                return new JsonObject { ["leave"] = leave.Result, ["timesheets"] = ts.Result };
            }),
            SectionAsync("performanceReview", async () =>
            {
                var r = await GetAsync("Performance", "api/v1/performance/reviews/me", ct);
                return r is null ? null : new JsonObject { ["id"] = r["id"]?.DeepClone(), ["status"] = r["status"]?.DeepClone(), ["cycle"] = r["cycle"]?["name"]?.DeepClone(), ["selfEvalDeadline"] = r["cycle"]?["selfEvalDeadline"]?.DeepClone() };
            })
        };
        var sections = await Task.WhenAll(tasks);     // all sections run concurrently
        var result = new JsonObject();
        if (profile.Data is { } p)
            result["profile"] = new JsonObject
            {
                ["employeeId"] = p["id"]?.DeepClone(), ["employeeCode"] = p["employeeCode"]?.DeepClone(), ["fullName"] = p["fullName"]?.DeepClone(), ["department"] = p["department"]?["name"]?.DeepClone(),
                ["designation"] = p["designation"]?["name"]?.DeepClone(), ["location"] = p["location"]?["name"]?.DeepClone(), ["manager"] = p["manager"]?.DeepClone(), ["status"] = p["status"]?.DeepClone(), ["tenureMonths"] = p["tenureMonths"]?.DeepClone()
            };
        Assemble(sections, result);
        var events = new JsonArray();
        if (sections.FirstOrDefault(s => s.Item1 == "upcomingHolidays").Item2 is JsonArray hs)
            foreach (var h in hs) events.Add(new JsonObject { ["type"] = "HOLIDAY", ["title"] = h?["name"]?.DeepClone(), ["date"] = h?["holidayDate"]?.DeepClone() });
        result["upcomingEvents"] = events;   // upcoming company events (holidays)
        if (!profile.Ok) ((JsonArray)result["unavailable"]!).Insert(0, "profile");
        return result;
    }

    private async Task<int?> SafeCount(string service, string path, CancellationToken ct)
    {
        try { return (await GetAsync(service, path, ct)) is JsonArray a ? a.Count : null; } catch (Exception ex) when (ex is not OperationCanceledException) { return null; }
    }

    public async Task<JsonObject> ManagerAsync(CancellationToken ct)
    {
        if (user.EmployeeId is null) return new JsonObject { ["message"] = "Your account is not linked to an employee", ["unavailable"] = new JsonArray() };
        if (!user.HasAnyPermission(Perm.TeamView, Perm.LeaveApprove, Perm.TimesheetApprove)) return new JsonObject { ["message"] = "Manager dashboard requires a manager role", ["unavailable"] = new JsonArray() };
        var me = user.EmployeeId;
        var sections = await Task.WhenAll(
            SectionAsync("team", () => GetAsync("Employee", $"api/v1/employees/{me}/team", ct)),
            SectionAsync("pendingLeaveApprovals", () => GetAsync("Leave", "api/v1/leaves/pending-approvals", ct)),
            SectionAsync("teamAttendance", async () => { var r = await GetAsync("Attendance", "api/v1/attendance/team", ct); return r is null ? null : new JsonObject { ["date"] = r["date"]?.DeepClone(), ["headcount"] = r["headcount"]?.DeepClone(), ["present"] = r["present"]?.DeepClone(), ["members"] = r["members"]?.DeepClone() }; }),
            SectionAsync("pendingTimesheetApprovals", () => GetAsync("Timesheet", "api/v1/timesheets/pending-approvals", ct)),
            SectionAsync("upcomingReviews", async () => (await GetAsync("Performance", "api/v1/performance/reviews?status=SELF_SUBMITTED&size=20", ct))?["items"]?.DeepClone()),
            SectionAsync("upcomingLeaves", () => GetAsync("Leave", "api/v1/leaves/upcoming", ct)));
        var result = Assemble(sections, new JsonObject());
        // team project allocation: one concurrent call per team member (bounded)
        var team = sections.First(s => s.Name == "team").Data as JsonArray ?? [];
        using var gate = new SemaphoreSlim(6);
        var allocs = await Task.WhenAll(team.Select(async m =>
        {
            await gate.WaitAsync(ct);
            try { return new JsonObject { ["employeeId"] = m?["employeeId"]?.DeepClone(), ["fullName"] = m?["fullName"]?.DeepClone(), ["allocations"] = await SafeNode("Project", $"api/v1/projects/employee/{m?["employeeId"]}", ct) }; }
            finally { gate.Release(); }
        }));
        result["teamProjectAllocation"] = new JsonArray(allocs.Select(a => (JsonNode?)a).ToArray());
        return result;
    }

    private async Task<JsonNode?> SafeNode(string service, string path, CancellationToken ct)
    {
        try { return await GetAsync(service, path, ct); } catch (Exception ex) when (ex is not OperationCanceledException) { return null; }
    }
}
