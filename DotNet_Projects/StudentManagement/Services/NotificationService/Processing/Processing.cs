using Microsoft.EntityFrameworkCore;
using NotificationService.Data;
using NotificationService.Entities;

namespace NotificationService.Processing;

/// <summary>Email SIMULATION (real SMTP is out of scope). Test hooks: recipients ending in "@fail.test" always fail; "@flaky.test" fail on the first two attempts.</summary>
public class EmailSimulator(ILogger<EmailSimulator> log)
{
    /// <summary>Permanent delivery problem: retrying cannot help, so the notification goes straight to Failed.</summary>
    public class NonRetryableNotificationException(string m) : Exception(m);

    public void Send(Notification n)
    {
        var to = n.RecipientEmail;
        if (string.IsNullOrWhiteSpace(to)) throw new NonRetryableNotificationException("No recipient email address");
        if (to.EndsWith("@fail.test") || (to.EndsWith("@flaky.test") && n.RetryCount < 2)) throw new InvalidOperationException("Simulated SMTP failure for " + to);
        log.LogInformation("EMAIL SENT to={To} type={Type} body=\"{Body}\"", to, n.NotificationType, n.Message);
    }
}

/// <summary>Sends ONE notification in its own scope/transaction; failures schedule an exponential back-off retry, then Failed.</summary>
public class NotificationProcessor(NotificationDbContext db, EmailSimulator email, IConfiguration cfg, ILogger<NotificationProcessor> log)
{
    public async Task ProcessAsync(long id, CancellationToken ct = default)
    {
        var n = await db.Notifications.FirstOrDefaultAsync(x => x.NotificationId == id, ct);
        if (n is null || n.Status != NotificationStatus.Pending) return;
        var maxAttempts = cfg.GetValue("Notification:MaxAttempts", 5);
        var baseBackoff = cfg.GetValue("Notification:BaseBackoffSeconds", 5);
        try
        {
            email.Send(n);
            n.Status = NotificationStatus.Sent; n.ProcessedAt = DateTime.UtcNow; n.LastError = null; n.NextAttemptAt = null;
        }
        catch (Exception ex)
        {
            n.RetryCount++;
            n.LastError = ex.Message.Length > 500 ? ex.Message[..500] : ex.Message;
            if (ex is EmailSimulator.NonRetryableNotificationException || n.RetryCount >= maxAttempts)
            {
                n.Status = NotificationStatus.Failed; n.ProcessedAt = DateTime.UtcNow;
                log.LogError("Notification {Id} permanently FAILED after {Attempts} attempt(s): {Msg}", id, n.RetryCount, ex.Message);
            }
            else
            {
                var delay = baseBackoff * (1 << (n.RetryCount - 1));
                n.NextAttemptAt = DateTime.UtcNow.AddSeconds(delay);
                log.LogWarning("Notification {Id} attempt {Attempt} failed, retry in {Delay}s: {Msg}", id, n.RetryCount, delay, ex.Message);
            }
        }
        n.Version++;
        await db.SaveChangesAsync(ct);
    }
}

/// <summary>Background job: picks up due Pending notifications (new ones + retries whose back-off has elapsed) every few seconds.</summary>
public class NotificationDispatcher(IServiceScopeFactory scopes, IConfiguration cfg, ILogger<NotificationDispatcher> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        var interval = TimeSpan.FromMilliseconds(cfg.GetValue("Notification:DispatchIntervalMs", 2000));
        var batch = cfg.GetValue("Notification:BatchSize", 50);
        using var timer = new PeriodicTimer(interval);
        while (await timer.WaitForNextTickAsync(stop))
        {
            try
            {
                List<long> due;
                using (var scope = scopes.CreateScope())
                {
                    var db = scope.ServiceProvider.GetRequiredService<NotificationDbContext>();
                    var now = DateTime.UtcNow;
                    due = await db.Notifications.AsNoTracking().Where(n => n.Status == NotificationStatus.Pending && (n.NextAttemptAt == null || n.NextAttemptAt <= now))
                        .OrderBy(n => n.NotificationId).Take(batch).Select(n => n.NotificationId).ToListAsync(stop);
                }
                foreach (var id in due)
                {
                    try { using var scope = scopes.CreateScope(); await scope.ServiceProvider.GetRequiredService<NotificationProcessor>().ProcessAsync(id, stop); }
                    catch (Exception e) when (e is not OperationCanceledException) { log.LogError(e, "Unexpected error processing notification {Id}", id); }
                }
            }
            catch (Exception e) when (e is not OperationCanceledException) { log.LogError("Dispatcher poll failed: {Msg}", e.Message); }
        }
    }
}
