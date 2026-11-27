using Confluent.Kafka;
using HMS.Shared.Common;
using HMS.Shared.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HMS.Shared.Messaging;

/// <summary>
/// BackgroundService (PeriodicTimer) that ships committed outbox rows to Kafka: events are therefore never published before
/// the business transaction has been committed, and never lost if the broker is down (at-least-once; consumers are idempotent).
/// </summary>
public sealed class OutboxRelayService(IServiceScopeFactory scopes, IOptions<KafkaOptions> options, ILogger<OutboxRelayService> log) : BackgroundService
{
    private readonly KafkaOptions _o = options.Value;
    private IProducer<string, string>? _producer;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        await Task.Delay(TimeSpan.FromSeconds(3), ct);   // let migrations finish first
        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(_o.OutboxPollIntervalMs));
        log.LogInformation("Outbox relay started (poll {Interval} ms)", _o.OutboxPollIntervalMs);
        while (await timer.WaitForNextTickAsync(ct))
        {
            try { await RelayOnceAsync(ct); }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception ex) { log.LogError(ex, "Outbox relay iteration failed"); }
        }
        _producer?.Flush(TimeSpan.FromSeconds(3));
        _producer?.Dispose();
    }

    private IProducer<string, string> Producer => _producer ??= new ProducerBuilder<string, string>(new ProducerConfig
    {
        BootstrapServers = _o.BootstrapServers,
        Acks = Acks.All,
        EnableIdempotence = true,
        MessageTimeoutMs = 6000,
        SocketTimeoutMs = 5000,
        AllowAutoCreateTopics = true
    }).Build();

    private async Task RelayOnceAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ServiceDbContext>();
        var pending = await db.Outbox.Where(m => m.SentAt == null).OrderBy(m => m.Id).Take(_o.OutboxBatchSize).ToListAsync(ct);
        foreach (var m in pending)
        {
            try
            {
                var msg = new Message<string, string> { Key = m.Key, Value = m.Payload, Headers = new Headers { { "eventType", System.Text.Encoding.UTF8.GetBytes(m.EventType) } } };
                if (m.CorrelationId is not null) msg.Headers.Add(CorrelationContext.HeaderName, System.Text.Encoding.UTF8.GetBytes(m.CorrelationId));
                var result = await Producer.ProduceAsync(m.Topic, msg, ct);
                m.SentAt = DateTime.UtcNow;
                m.Attempts++;
                log.LogInformation("Kafka PRODUCED {EventType} to {Topic}[{Partition}]@{Offset} key={Key} outbox#{Id}", m.EventType, result.Topic, result.Partition.Value, result.Offset.Value, m.Key, m.Id);
            }
            catch (ProduceException<string, string> ex)
            {
                m.Attempts++;
                log.LogWarning("Kafka produce failed for outbox#{Id} topic {Topic} (attempt {Attempts}, will retry): {Reason}", m.Id, m.Topic, m.Attempts, ex.Error.Reason);
                await db.SaveChangesAsync(ct);
                return;   // keep ordering: stop this batch, retry on the next tick
            }
            await db.SaveChangesAsync(ct);
        }
    }
}
