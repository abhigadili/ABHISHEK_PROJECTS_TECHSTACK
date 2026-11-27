using StudentMgmt.BuildingBlocks.Contracts;
using StudentMgmt.BuildingBlocks.Contracts.Events;
using StudentMgmt.BuildingBlocks.Messaging;

namespace StudentMgmt.CourseService.Kafka.Producers;

/// <summary>
/// Thin wrapper around <see cref="IEventProducer"/> so the application service
/// never has to know Kafka topic names or construct integration events itself.
/// </summary>
public class CourseEventPublisher
{
    private readonly IEventProducer _eventProducer;

    public CourseEventPublisher(IEventProducer eventProducer)
    {
        _eventProducer = eventProducer;
    }

    public Task PublishCourseCreatedAsync(Guid courseId, string courseCode, string title, int credits, int capacity, CancellationToken cancellationToken = default) =>
        _eventProducer.PublishAsync(KafkaTopics.CourseCreated, new CourseCreatedEvent
        {
            CourseId = courseId,
            CourseCode = courseCode,
            Title = title,
            Credits = credits,
            Capacity = capacity
        }, cancellationToken);

    public Task PublishCourseUpdatedAsync(Guid courseId, string courseCode, string title, int credits, int capacity, CancellationToken cancellationToken = default) =>
        _eventProducer.PublishAsync(KafkaTopics.CourseUpdated, new CourseUpdatedEvent
        {
            CourseId = courseId,
            CourseCode = courseCode,
            Title = title,
            Credits = credits,
            Capacity = capacity
        }, cancellationToken);

    public Task PublishCourseDeletedAsync(Guid courseId, string courseCode, CancellationToken cancellationToken = default) =>
        _eventProducer.PublishAsync(KafkaTopics.CourseDeleted, new CourseDeletedEvent
        {
            CourseId = courseId,
            CourseCode = courseCode
        }, cancellationToken);
}
