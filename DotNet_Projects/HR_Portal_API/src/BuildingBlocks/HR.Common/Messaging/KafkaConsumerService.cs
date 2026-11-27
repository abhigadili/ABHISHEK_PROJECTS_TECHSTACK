using System.Text;
using System.Text.Json;
using Confluent.Kafka;
using HR.Common.Common;
using HR.Common.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Serilog.Context;

namespace HR.Common.Messaging;

/// <summary>Where the event being handled came from (topic / partition / offset) - ambient for the duration of one handler call.</summary>
public sealed record ConsumeContext(string Topic, int Partition, long Offset)
{
    private static readonly AsyncLocal<ConsumeContext?> Holder = new();
    public static ConsumeContext? Current { get => Holder.Value; set => Holder.Value = value; }
}

/// <summary>A handler for one event type on one topic. Handlers run in a DB transaction together with the idempotency (inbox) row.</summary>
public interface IEventHandler
{
    string Topic { get; }
    Type EventType { get; }
    string Name { get; }
    Task HandleAsync(IntegrationEvent evt, CancellationToken ct);
}

public abstract class EventHandlerBase<TEvent> : IEventHandler where TEvent : IntegrationEvent
{
    public abstract string Topic { get; }
    public virtual string Name => GetType().Name;
    public Type EventType => typeof(TEvent);
    public Task HandleAsync(IntegrationEvent evt, CancellationToken ct) => HandleAsync((TEvent)evt, ct);
    protected abstract Task HandleAsync(TEvent evt, CancellationToken ct);
}

/// <summary>
/// Kafka consumer (one consumer group per service, manual offset commit). Per record: deserialize -> transaction { skip if already
/// processed, run handler(s), write inbox row } -> commit offset. Failures are retried with exponential back-off; after the final
/// attempt (or immediately for poison messages) the record is parked on "&lt;topic&gt;.DLT" and the offset is committed.
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
        try { await Task.Delay(TimeSpan.FromSeconds(4), ct); } catch (OperationCanceledException) { return; }

        using var consumer = new ConsumerBuilder<string, string>(new ConsumerConfig
        {
            BootstrapServers = _o.BootstrapServers, GroupId = _o.GroupId, AutoOffsetReset = AutoOffsetReset.Earliest,
            EnableAutoCommit = false, AllowAutoCreateTopics = true, SessionTimeoutMs = 15000
        }).SetErrorHandler((_, e) => log.LogWarning("Kafka consumer error: {Reason}", e.Reason)).Build();
        using var dlt = new ProducerBuilder<string, string>(new ProducerConfig { BootstrapServers = _o.BootstrapServers, Acks = Acks.All, MessageTimeoutMs = 6000 }).Build();
        consumer.Subscribe(topics);
        log.LogInformation("Kafka consumer group {Group} subscribed to {Topics}", _o.GroupId, string.Join(", ", topics));

        while (!ct.IsCancellationRequested)
        {
            ConsumeResult<string, string>? cr;
            try { cr = consumer.Consume(TimeSpan.FromSeconds(1)); }
            catch (ConsumeException ex) { log.LogWarning("Kafka consume problem: {Reason}", ex.Error.Reason); try { await Task.Delay(1000, ct); } catch (OperationCanceledException) { break; } continue; }
            catch (OperationCanceledException) { break; }
            if (cr is null) continue;

            var correlation = cr.Message.Headers.TryGetLastBytes(CorrelationContext.HeaderName, out var cb) ? Encoding.UTF8.GetString(cb) : CorrelationContext.NewId();
            CorrelationContext.Id = correlation;
            using (LogContext.PushProperty("CorrelationId", correlation))
            {
                try { await ProcessWithRetryAsync(cr, handlers, dlt, ct); consumer.Commit(cr); }
                catch (OperationCanceledException) { break; }
            }
        }
        try { consumer.Close(); } catch { /* shutting down */ }
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
            var reason = last?.Message ?? "unknown";
            var msg = new Message<string, string> { Key = cr.Message.Key, Value = cr.Message.Value, Headers = new Headers { { "error", Encoding.UTF8.GetBytes(reason[..Math.Min(200, reason.Length)]) }, { "originalTopic", Encoding.UTF8.GetBytes(cr.Topic) } } };
            await dlt.ProduceAsync(Topics.Dlt(cr.Topic), msg, ct);
        }
        catch (Exception ex) { log.LogError(ex, "Could not write {Topic} record to the dead-letter topic", cr.Topic); }
    }

    private async Task ProcessOneAsync(ConsumeResult<string, string> cr, IEventHandler handler, CancellationToken ct)
    {
        IntegrationEvent? evt;
        try { evt = JsonSerializer.Deserialize(cr.Message.Value, handler.EventType, EventPublisher.Json) as IntegrationEvent; }
        catch (JsonException ex) { throw new PoisonMessageException("Undeserialisable " + handler.EventType.Name + ": " + ex.Message); }
        if (evt is null) throw new PoisonMessageException("Empty " + handler.EventType.Name);
        if (evt.SchemaVersion > 1) throw new PoisonMessageException($"Unsupported event schema version {evt.SchemaVersion}");

        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HrDbContext>();
        var consumerName = _o.GroupId + ":" + handler.Name;
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
            var scoped = scope.ServiceProvider.GetServices<IEventHandler>().First(h => h.Topic == handler.Topic && h.Name == handler.Name);
            log.LogInformation("Kafka CONSUMED {EventType} {EventId} from {Topic}[{Partition}]@{Offset} by {Consumer}", handler.EventType.Name, evt.EventId, cr.Topic, cr.Partition.Value, cr.Offset.Value, consumerName);
            ConsumeContext.Current = new ConsumeContext(cr.Topic, cr.Partition.Value, cr.Offset.Value);
            await scoped.HandleAsync(evt, ct);
            db.Inbox.Add(new InboxMessage { EventId = evt.EventId, Consumer = consumerName });
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        });
    }

    private sealed class PoisonMessageException(string message) : Exception(message);
}
