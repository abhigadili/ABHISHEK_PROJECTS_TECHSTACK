using HR.AttendanceService.Services;
using HR.Common.Hosting;

namespace HR.AttendanceService.Jobs;

/// <summary>BackgroundService (PeriodicTimer): flags yesterday's open check-ins as MISSING_PUNCH; interval from configuration.</summary>
public sealed class MissingPunchJob(IServiceScopeFactory scopes, IConfiguration cfg, ILogger<MissingPunchJob> log)
    : PeriodicJob(scopes, cfg, log, "missing-punch", "Scheduler:MissingPunchIntervalSeconds", 3600)
{
    protected override async Task RunAsync(IServiceProvider services, CancellationToken ct)
    {
        var n = await services.GetRequiredService<IAttendanceService>().MarkMissingPunchesAsync(ct);
        if (n > 0) log.LogInformation("Flagged {Count} attendance records as MISSING_PUNCH", n);
    }
}
