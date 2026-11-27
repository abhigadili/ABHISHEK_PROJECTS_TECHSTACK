using System.Text;
using Confluent.Kafka;
using HR.Common.Common;
using HR.Common.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HR.Common.Messaging;

/// <summary>
/// BackgroundService (PeriodicTimer) that ships committed outbox rows to Kafka. Events are never published before the business
/// transaction commits and are never lost if the broker is down (at-least-once; consumers are idempotent).
/// Several instances can run safely: rows are claimed with SELECT ... FOR UPDATE SKIP LOCKED inside a short transaction.
/// </summary>
public sealed class OutboxRelayService(IServiceScopeFactory scopes, IOptions<KafkaOptions> options, ILogger<OutboxRelayService> log) : BackgroundService
{
    private readonly KafkaOptions _o = options.Value;
    private IProducer<string, string>? _producer;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        try { await Task.Delay(TimeSpan.FromSeconds(3), ct); } catch (OperationCanceledException) { return; }
        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(_o.OutboxPollIntervalMs));
        log.LogInformation("Outbox relay started (poll {Interval} ms)", _o.OutboxPollIntervalMs);
        try
        {
            while (await timer.WaitForNextTickAsync(ct))
            {
                try { await RelayOnceAsync(ct); }
                catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
                catch (Exception ex) { log.LogError(ex, "Outbox relay iteration failed"); }
            }
        }
        catch (OperationCanceledException) { }
        _producer?.Flush(TimeSpan.FromSeconds(3));
        _producer?.Dispose();
    }

    private IProducer<string, string> Producer => _producer ??= new ProducerBuilder<string, string>(new ProducerConfig
    {
        BootstrapServers = _o.BootstrapServers, Acks = Acks.All, EnableIdempotence = true, MessageTimeoutMs = 6000, SocketTimeoutMs = 5000, AllowAutoCreateTopics = true
    }).Build();

    private async Task RelayOnceAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HrDbContext>();
        if (!await db.Outbox.AnyAsync(m => m.SentAt == null, ct)) return;
        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var batch = await db.Outbox.FromSqlInterpolated($"SELECT * FROM dn_outbox_events WHERE sent_at IS NULL ORDER BY id LIMIT {_o.OutboxBatchSize} FOR UPDATE SKIP LOCKED").ToListAsync(ct);
            foreach (var m in batch)
            {
                var msg = new Message<string, string> { Key = m.EventKey ?? m.EventId, Value = m.Payload, Headers = new Headers { { "eventType", Encoding.UTF8.GetBytes(m.EventType) }, { "eventId", Encoding.UTF8.GetBytes(m.EventId) } } };
                if (m.CorrelationId is not null) msg.Headers.Add(CorrelationContext.HeaderName, Encoding.UTF8.GetBytes(m.CorrelationId));
                try
                {
                    var r = await Producer.ProduceAsync(m.Topic, msg, ct);
                    m.SentAt = DateTime.UtcNow;
                    m.Attempts++;
                    log.LogInformation("Kafka PRODUCED {EventType} -> {Topic}[{Partition}]@{Offset} key={Key}", m.EventType, r.Topic, r.Partition.Value, r.Offset.Value, m.EventKey);
                }
                catch (ProduceException<string, string> ex)
                {
                    m.Attempts++;
                    log.LogWarning("Kafka produce failed for outbox#{Id} ({Topic}), attempt {Attempts}: {Reason}", m.Id, m.Topic, m.Attempts, ex.Error.Reason);
                    break;   // keep ordering: stop this batch, retry on the next tick
                }
            }
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        });
    }
}
