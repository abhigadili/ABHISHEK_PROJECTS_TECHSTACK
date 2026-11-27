using System.Text;
using System.Text.Json;
using Confluent.Kafka;
using HMS.Shared.Common;
using HMS.Shared.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Serilog.Context;

namespace HMS.Shared.Messaging;

/// <summary>A handler for one event type. Handlers run inside a DB transaction together with the idempotency (inbox) row.</summary>
public interface IEventHandler
{
    string Topic { get; }
    Type EventType { get; }
    /// <summary>Stable name of the consumer, part of the idempotency key.</summary>
    string Name { get; }
    Task HandleAsync(IntegrationEvent evt, CancellationToken ct);
}

public abstract class KafkaEventHandler<TEvent> : IEventHandler where TEvent : IntegrationEvent
{
    public abstract string Topic { get; }
    public virtual string Name => GetType().Name;
    public Type EventType => typeof(TEvent);
    public Task HandleAsync(IntegrationEvent evt, CancellationToken ct) => HandleAsync((TEvent)evt, ct);
    protected abstract Task HandleAsync(TEvent evt, CancellationToken ct);
}

/// <summary>
/// Kafka consumer hosted service (one consumer group per microservice, manual offset commit).
/// Per message: deserialize -> (transaction: skip if already processed, run handler, write inbox row) -> commit offset.
/// Failures are retried with exponential back-off; after the last attempt (or immediately for poison messages) the record is
/// parked on "&lt;topic&gt;.DLT" and the offset is committed so the partition keeps moving.
/// </summary>
public sealed class KafkaConsumerService(IServiceScopeFactory scopes, IOptions<KafkaOptions> options, ILogger<KafkaConsumerService> log) : BackgroundService
{
    private readonly KafkaOptions _o = options.Value;

    protected override Task ExecuteAsync(CancellationToken ct) => Task.Run(() => RunAsync(ct), ct);

    private async Task RunAsync(CancellationToken ct)
    {
        List<IEventHandler> handlers;
        using (var scope = scopes.CreateScope()) handlers = scope.ServiceProvider.GetServices<IEventHandler>().ToList();
        var topics = handlers.Select(h => h.Topic).Distinct().ToList();
        if (topics.Count == 0) return;
        var types = handlers.GroupBy(h => h.Topic).ToDictionary(g => g.Key, g => g.Select(h => h.EventType).Distinct().ToList());

        await Task.Delay(TimeSpan.FromSeconds(4), ct);   // wait for migrations / topic creation
        using var consumer = new ConsumerBuilder<string, string>(new ConsumerConfig
        {
            BootstrapServers = _o.BootstrapServers,
            GroupId = _o.GroupId,
            AutoOffsetReset = AutoOffsetReset.Earliest,
            EnableAutoCommit = false,
            AllowAutoCreateTopics = true,
            SessionTimeoutMs = 15000
        }).SetErrorHandler((_, e) => log.LogWarning("Kafka consumer error: {Reason}", e.Reason)).Build();
        using var dlt = new ProducerBuilder<string, string>(new ProducerConfig { BootstrapServers = _o.BootstrapServers, Acks = Acks.All, MessageTimeoutMs = 6000 }).Build();
        consumer.Subscribe(topics);
        log.LogInformation("Kafka consumer group {Group} subscribed to {Topics}", _o.GroupId, string.Join(", ", topics));

        while (!ct.IsCancellationRequested)
        {
            ConsumeResult<string, string>? cr;
            try { cr = consumer.Consume(TimeSpan.FromSeconds(1)); }
            catch (ConsumeException ex) { log.LogWarning("Kafka consume problem: {Reason}", ex.Error.Reason); await Task.Delay(1000, ct); continue; }
            catch (OperationCanceledException) { break; }
            if (cr is null) continue;

            var correlation = cr.Message.Headers.TryGetLastBytes(CorrelationContext.HeaderName, out var cb) ? Encoding.UTF8.GetString(cb) : CorrelationContext.NewId();
            CorrelationContext.Id = correlation;
            using (LogContext.PushProperty("CorrelationId", correlation))
            {
                await ProcessWithRetryAsync(cr, handlers, dlt, ct);
                consumer.Commit(cr);
            }
        }
        consumer.Close();
    }

    private async Task ProcessWithRetryAsync(ConsumeResult<string, string> cr, List<IEventHandler> handlers, IProducer<string, string> dlt, CancellationToken ct)
    {
        var topicHandlers = handlers.Where(h => h.Topic == cr.Topic).ToList();
        Exception? last = null;
        for (var attempt = 1; attempt <= _o.MaxProcessingAttempts; attempt++)
        {
            try
            {
                foreach (var h in topicHandlers) await ProcessOneAsync(cr, h, ct);
                return;
            }
            catch (PoisonMessageException ex) { last = ex; break; }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
            catch (Exception ex)
            {
                last = ex;
                log.LogWarning(ex, "Kafka handler failed for {Topic}@{Offset} (attempt {Attempt}/{Max})", cr.Topic, cr.Offset.Value, attempt, _o.MaxProcessingAttempts);
                if (attempt < _o.MaxProcessingAttempts) await Task.Delay(_o.RetryBaseDelayMs * (1 << (attempt - 1)), ct);
            }
        }
        log.LogError(last, "Giving up on {Topic}[{Partition}]@{Offset} -> dead-letter topic", cr.Topic, cr.Partition.Value, cr.Offset.Value);
        try
        {
            var msg = new Message<string, string> { Key = cr.Message.Key, Value = cr.Message.Value, Headers = new Headers { { "error", Encoding.UTF8.GetBytes((last?.Message ?? "unknown")[..Math.Min(200, last?.Message.Length ?? 7)]) } } };
            await dlt.ProduceAsync(Topics.Dlt(cr.Topic), msg, ct);
        }
        catch (Exception ex) { log.LogError(ex, "Could not write {Topic} to the dead-letter topic", cr.Topic); }
    }

    private async Task ProcessOneAsync(ConsumeResult<string, string> cr, IEventHandler handler, CancellationToken ct)
    {
        IntegrationEvent? evt;
        try { evt = JsonSerializer.Deserialize(cr.Message.Value, handler.EventType, EventPublisher.Json) as IntegrationEvent; }
        catch (JsonException ex) { throw new PoisonMessageException("Undeserialisable " + handler.EventType.Name + ": " + ex.Message); }
        if (evt is null) throw new PoisonMessageException("Empty " + handler.EventType.Name);

        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ServiceDbContext>();
        var consumerName = _o.GroupId + ":" + handler.Name;
        // the execution strategy (retry on failure) must wrap the whole transaction
        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            if (await db.Inbox.AnyAsync(i => i.EventId == evt.EventId && i.Consumer == consumerName, ct))
            {
                log.LogInformation("Duplicate event {EventId} ignored by {Consumer}", evt.EventId, consumerName);
                return;
            }
            // handlers resolved from the SAME scope so they share the DbContext/transaction
            var scoped = scope.ServiceProvider.GetServices<IEventHandler>().First(h => h.GetType() == handler.GetType());
            log.LogInformation("Kafka CONSUMED {EventType} {EventId} from {Topic}[{Partition}]@{Offset} by {Consumer}", handler.EventType.Name, evt.EventId, cr.Topic, cr.Partition.Value, cr.Offset.Value, consumerName);
            await scoped.HandleAsync(evt, ct);
            db.Inbox.Add(new InboxMessage { EventId = evt.EventId, Consumer = consumerName });
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        });
    }

    private sealed class PoisonMessageException(string message) : Exception(message);
}
