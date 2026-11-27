using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HMS.Shared.Hosting;

/// <summary>
/// Base class of the hosted scheduler jobs: a BackgroundService driven by a PeriodicTimer. The interval comes from configuration
/// (e.g. "Scheduler:ReminderIntervalSeconds") and "Scheduler:InitialDelaySeconds" delays the first run - nothing is hard-coded.
/// </summary>
public abstract class PeriodicJob(IServiceScopeFactory scopes, IConfiguration cfg, ILogger log, string jobName, string intervalKey, int defaultIntervalSeconds) : BackgroundService
{
    protected abstract Task RunAsync(IServiceProvider services, CancellationToken ct);

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        var initial = TimeSpan.FromSeconds(cfg.GetValue("Scheduler:InitialDelaySeconds", 30));
        var interval = TimeSpan.FromSeconds(Math.Max(1, cfg.GetValue(intervalKey, defaultIntervalSeconds)));
        try { await Task.Delay(initial, ct); } catch (OperationCanceledException) { return; }
        log.LogInformation("Scheduled job {Job} started (every {Interval})", jobName, interval);
        using var timer = new PeriodicTimer(interval);
        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                await RunAsync(scope.ServiceProvider, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception ex) { log.LogError(ex, "Scheduled job {Job} failed", jobName); }
        }
        while (await WaitAsync(timer, ct));
    }

    private static async Task<bool> WaitAsync(PeriodicTimer t, CancellationToken ct)
    {
        try { return await t.WaitForNextTickAsync(ct); } catch (OperationCanceledException) { return false; }
    }
}
