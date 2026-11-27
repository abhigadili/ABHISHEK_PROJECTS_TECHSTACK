using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using HR.Common.Common;
using HR.Common.Data;

namespace HR.Common.Messaging;

/// <summary>Transactional outbox row (dn_outbox_events): stored in the SAME transaction as the business change, relayed to Kafka afterwards.</summary>
public class OutboxMessage
{
    public long Id { get; set; }
    public string EventId { get; set; } = "";
    public string EventType { get; set; } = "";
    public string Topic { get; set; } = "";
    public string? EventKey { get; set; }
    public string Payload { get; set; } = "";
    public string? CorrelationId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SentAt { get; set; }
    public int Attempts { get; set; }
}

/// <summary>Idempotency ledger (dn_processed_events): a (EventId, Consumer) pair is processed at most once.</summary>
public class InboxMessage
{
    public long Id { get; set; }
    public string EventId { get; set; } = "";
    public string Consumer { get; set; } = "";
    public DateTime ProcessedAt { get; set; } = DateTime.UtcNow;
}

public interface IEventPublisher
{
    /// <summary>Stages the event in the outbox of the current DbContext; it is committed (and later relayed) together with the caller's SaveChanges.</summary>
    void Publish(string topic, string key, IntegrationEvent evt);
}

public sealed class EventPublisher(HrDbContext db) : IEventPublisher
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(), new Common.FlexibleTimeOnlyConverter() },
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public void Publish(string topic, string key, IntegrationEvent evt) =>
        db.Outbox.Add(new OutboxMessage
        {
            EventId = evt.EventId,
            EventType = evt.GetType().Name,
            Topic = topic,
            EventKey = key,
            Payload = JsonSerializer.Serialize(evt, evt.GetType(), Json),
            CorrelationId = evt.CorrelationId ?? CorrelationContext.Id
        });
}

public sealed class KafkaOptions
{
    public string BootstrapServers { get; set; } = "localhost:9492";
    public string GroupId { get; set; } = "hr";
    public int OutboxPollIntervalMs { get; set; } = 700;
    public int OutboxBatchSize { get; set; } = 50;
    public int MaxProcessingAttempts { get; set; } = 3;
    public int RetryBaseDelayMs { get; set; } = 500;
    public int Partitions { get; set; } = 3;
}
