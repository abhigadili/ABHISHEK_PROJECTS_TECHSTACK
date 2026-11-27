using StudentMgmt.BuildingBlocks.Contracts.Events;

namespace StudentMgmt.BuildingBlocks.Messaging;

/// <summary>
/// Publishes integration events to Kafka. Registered as a Singleton (see
/// <see cref="ServiceCollectionExtensions"/>) because the underlying Confluent
/// <c>IProducer</c> is a long-lived, thread-safe connection that is expensive to
/// open/close per-request — exactly the case where the Singleton pattern belongs.
/// </summary>
public interface IEventProducer
{
    Task PublishAsync<TEvent>(string topic, TEvent @event, CancellationToken cancellationToken = default)
        where TEvent : IntegrationEvent;
}
