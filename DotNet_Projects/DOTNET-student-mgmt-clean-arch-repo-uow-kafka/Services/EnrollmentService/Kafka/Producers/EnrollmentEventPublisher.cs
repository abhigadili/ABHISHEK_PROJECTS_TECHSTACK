using StudentMgmt.BuildingBlocks.Contracts;
using StudentMgmt.BuildingBlocks.Contracts.Events;
using StudentMgmt.BuildingBlocks.Messaging;

namespace StudentMgmt.EnrollmentService.Kafka.Producers;

/// <summary>
/// Thin, intention-revealing wrapper around the shared <see cref="IEventProducer"/>
/// so EnrollmentAppService calls <c>PublishEnrollmentCreatedAsync(...)</c> instead
/// of repeating the topic name + event type at every call site.
/// </summary>
public class EnrollmentEventPublisher
{
    private readonly IEventProducer _eventProducer;

    public EnrollmentEventPublisher(IEventProducer eventProducer)
    {
        _eventProducer = eventProducer;
    }

    public Task PublishEnrollmentCreatedAsync(EnrollmentCreatedEvent @event, CancellationToken cancellationToken = default) =>
        _eventProducer.PublishAsync(KafkaTopics.EnrollmentCreated, @event, cancellationToken);

    public Task PublishEnrollmentCancelledAsync(EnrollmentCancelledEvent @event, CancellationToken cancellationToken = default) =>
        _eventProducer.PublishAsync(KafkaTopics.EnrollmentCancelled, @event, cancellationToken);
}
