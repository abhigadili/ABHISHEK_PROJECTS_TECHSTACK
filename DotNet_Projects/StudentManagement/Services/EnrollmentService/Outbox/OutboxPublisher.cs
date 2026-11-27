using System.Diagnostics.Metrics;
using Common;
using EnrollmentService.Data;
using EnrollmentService.Entities;
using Messaging;
using Microsoft.EntityFrameworkCore;

namespace EnrollmentService.Outbox;

/// <summary>
/// Background publisher of the transactional outbox. Each poll locks due rows (FOR UPDATE SKIP LOCKED), publishes them to RabbitMQ
/// (persistent messages, publisher confirms) and marks them Published only after the broker confirmed. Failures are retried with exponential
/// back-off and never dropped, so an event committed with its business change survives crashes of either the service or the broker
/// (at-least-once delivery; consumers de-duplicate via their inbox).
/// </summary>
public class OutboxPublisher : BackgroundService
{
    public static readonly Meter Meter = new("enrollment-service");
    private static readonly Counter<long> Published = Meter.CreateCounter<long>("outbox_events_published");
    private static readonly Counter<long> Failed = Meter.CreateCounter<long>("outbox_events_failed");

    private readonly IServiceScopeFactory _scopes;
    private readonly IEventPublisher _publisher;
    private readonly IConfiguration _cfg;
    private readonly ILogger<OutboxPublisher> _log;

    public OutboxPublisher(IServiceScopeFactory scopes, IEventPublisher publisher, IConfiguration cfg, ILogger<OutboxPublisher> log)
    {
        _scopes = scopes; _publisher = publisher; _cfg = cfg; _log = log;
        Meter.CreateObservableGauge("outbox_events_pending", () => PendingCount);
    }

    private long _pending;
    private long PendingCount => Interlocked.Read(ref _pending);

    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(_cfg.GetValue("Outbox:IntervalMs", 1000)));
        while (await timer.WaitForNextTickAsync(stop))
        {
            try { using var scope = _scopes.CreateScope(); await PublishBatchAsync(scope.ServiceProvider.GetRequiredService<EnrollmentDbContext>(), stop); }
            catch (Exception e) when (e is not OperationCanceledException) { _log.LogError("Outbox poll failed: {Msg}", e.Message); }
        }
    }

    /// <summary>Publishes one batch inside a transaction (public for tests). Returns the number of events published.</summary>
    public async Task<int> PublishBatchAsync(EnrollmentDbContext db, CancellationToken ct = default)
    {
        var batch = _cfg.GetValue("Outbox:BatchSize", 50);
        return await db.InTransactionAsync(async () =>
        {
            var due = await db.Outbox.FromSqlInterpolated(
                $"SELECT * FROM dn_outbox_messages WHERE Status = 'Pending' AND NextAttemptAt <= UTC_TIMESTAMP(6) ORDER BY OutboxId LIMIT {batch} FOR UPDATE SKIP LOCKED")
                .ToListAsync(ct);
            var blocked = new HashSet<long>();           // keep per-enrollment ordering: after a failure skip that enrollment's later events
            var ok = 0;
            foreach (var m in due)
            {
                if (blocked.Contains(m.AggregateId)) continue;
                try
                {
                    _publisher.Publish(m.RoutingKey, m.EventId, m.EventType, m.Payload, m.CorrelationId);
                    m.Status = OutboxStatus.Published; m.PublishedAt = DateTime.UtcNow; m.LastError = null;
                    Published.Add(1); ok++;
                }
                catch (Exception ex)
                {
                    m.Attempts++;
                    var delay = Math.Min(60, 1 << Math.Min(m.Attempts, 6));
                    m.NextAttemptAt = DateTime.UtcNow.AddSeconds(delay);
                    m.LastError = ex.Message.Length > 500 ? ex.Message[..500] : ex.Message;
                    blocked.Add(m.AggregateId);
                    Failed.Add(1);
                    _log.LogWarning("Outbox publish failed eventId={EventId} attempt={Attempt} retry in {Delay}s: {Msg}", m.EventId, m.Attempts, delay, ex.Message);
                }
            }
            await db.SaveChangesAsync(ct);
            Interlocked.Exchange(ref _pending, await db.Outbox.CountAsync(o => o.Status == OutboxStatus.Pending, ct));
            return ok;
        }, ct);
    }
}
