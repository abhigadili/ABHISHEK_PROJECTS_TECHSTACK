namespace HMS.Shared.Messaging;

/// <summary>Transactional outbox row: saved in the same DB transaction as the business change, relayed to Kafka afterwards.</summary>
public class OutboxMessage
{
    public long Id { get; set; }
    public string Topic { get; set; } = "";
    public string Key { get; set; } = "";
    public string Payload { get; set; } = "";
    public string EventType { get; set; } = "";
    public string? CorrelationId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SentAt { get; set; }
    public int Attempts { get; set; }
}

/// <summary>Idempotency ledger: a (EventId, Consumer) pair is processed at most once.</summary>
public class InboxMessage
{
    public long Id { get; set; }
    public Guid EventId { get; set; }
    public string Consumer { get; set; } = "";
    public DateTime ProcessedAt { get; set; } = DateTime.UtcNow;
}
