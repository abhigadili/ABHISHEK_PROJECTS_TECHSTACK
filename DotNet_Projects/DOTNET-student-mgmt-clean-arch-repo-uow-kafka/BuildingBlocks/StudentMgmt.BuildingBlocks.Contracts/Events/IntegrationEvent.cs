namespace StudentMgmt.BuildingBlocks.Contracts.Events;

/// <summary>
/// Base class every Kafka integration event inherits from. Carries the metadata
/// every consumer needs regardless of the concrete event payload: a unique id for
/// idempotency checks, the UTC time it was raised, and the correlation id used to
/// trace one logical request across every service/topic it touches.
/// </summary>
public abstract class IntegrationEvent
{
    protected IntegrationEvent()
    {
        EventId = Guid.NewGuid();
        OccurredOnUtc = DateTime.UtcNow;
    }

    protected IntegrationEvent(Guid correlationId) : this()
    {
        CorrelationId = correlationId;
    }

    public Guid EventId { get; init; }

    public DateTime OccurredOnUtc { get; init; }

    public Guid CorrelationId { get; init; } = Guid.NewGuid();
}
