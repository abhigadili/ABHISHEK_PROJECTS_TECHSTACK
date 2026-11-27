namespace HR.Common.Cache;

/// <summary>Central place for cache key names and TTLs (cache keys are never built ad hoc in services).</summary>
public static class CacheKeys
{
    public static string EmployeeProfile(string id) => $"employee:profile:{id}";
    public static string EmployeeDirectory(string hash) => $"employee:directory:{hash}";
    public const string EmployeePrefix = "employee:";
    public static string OrgChart(string? root) => $"org:chart:{root ?? "all"}";
    public const string OrgPrefix = "org:";
    public static string HolidayCalendar(int year, string? loc) => $"holiday:calendar:{year}:{loc ?? "all"}";
    public const string HolidayPrefix = "holiday:";
    public static string LeaveBalance(string emp, int year) => $"leave:balance:{emp}:{year}";
    public static string LeaveBalancePrefix(string emp) => $"leave:balance:{emp}:";
    public const string ReferenceData = "ref:";

    public static readonly TimeSpan Short = TimeSpan.FromMinutes(2), Medium = TimeSpan.FromMinutes(10), Long = TimeSpan.FromHours(1);
}
