using StudentMgmt.BuildingBlocks.Contracts;
using StudentMgmt.BuildingBlocks.Contracts.Events;
using StudentMgmt.BuildingBlocks.Messaging;
using StudentMgmt.StudentService.Entities;

namespace StudentMgmt.StudentService.Kafka.Producers;

/// <summary>
/// Thin wrapper around <see cref="IEventProducer"/> so application services depend
/// on a Student-domain-shaped API instead of the generic messaging abstraction.
/// </summary>
public class StudentEventPublisher
{
    private readonly IEventProducer _eventProducer;

    public StudentEventPublisher(IEventProducer eventProducer)
    {
        _eventProducer = eventProducer;
    }

    public Task PublishStudentCreatedAsync(Student student, CancellationToken cancellationToken = default) =>
        _eventProducer.PublishAsync(KafkaTopics.StudentCreated, new StudentCreatedEvent
        {
            StudentId = student.Id,
            FirstName = student.FirstName,
            LastName = student.LastName,
            Email = student.Email,
            DateOfBirth = student.DateOfBirth,
            EnrollmentNumber = student.EnrollmentNumber
        }, cancellationToken);

    public Task PublishStudentUpdatedAsync(Student student, CancellationToken cancellationToken = default) =>
        _eventProducer.PublishAsync(KafkaTopics.StudentUpdated, new StudentUpdatedEvent
        {
            StudentId = student.Id,
            FirstName = student.FirstName,
            LastName = student.LastName,
            Email = student.Email,
            EnrollmentNumber = student.EnrollmentNumber
        }, cancellationToken);

    public Task PublishStudentDeletedAsync(Student student, CancellationToken cancellationToken = default) =>
        _eventProducer.PublishAsync(KafkaTopics.StudentDeleted, new StudentDeletedEvent
        {
            StudentId = student.Id,
            EnrollmentNumber = student.EnrollmentNumber
        }, cancellationToken);
}
