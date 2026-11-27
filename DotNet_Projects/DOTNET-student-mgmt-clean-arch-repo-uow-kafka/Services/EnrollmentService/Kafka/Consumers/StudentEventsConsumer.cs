using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StudentMgmt.BuildingBlocks.Contracts;
using StudentMgmt.BuildingBlocks.Contracts.Events;
using StudentMgmt.BuildingBlocks.Messaging;
using StudentMgmt.EnrollmentService.Services.Interfaces;

namespace StudentMgmt.EnrollmentService.Kafka.Consumers;

/// <summary>
/// Consumes StudentService's own lifecycle events and mirrors just the fields
/// EnrollmentService needs into the local StudentSnapshot read model. This is the
/// only mechanism by which EnrollmentService learns anything about a student —
/// per Database-per-Service it must never query StudentDotnetDB directly.
/// </summary>
public class StudentEventsConsumer : KafkaConsumerBase
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    protected override string[] Topics => new[]
    {
        KafkaTopics.StudentCreated,
        KafkaTopics.StudentUpdated,
        KafkaTopics.StudentDeleted
    };

    public StudentEventsConsumer(IServiceProvider serviceProvider, IOptions<KafkaSettings> options, ILogger<StudentEventsConsumer> logger)
        : base(serviceProvider, options, logger)
    {
    }

    protected override async Task HandleMessageAsync(
        string topic,
        string? eventType,
        string rawMessage,
        IServiceProvider scopedServiceProvider,
        CancellationToken cancellationToken)
    {
        var syncService = scopedServiceProvider.GetRequiredService<ISnapshotSyncService>();

        switch (eventType)
        {
            case nameof(StudentCreatedEvent):
            {
                var @event = JsonSerializer.Deserialize<StudentCreatedEvent>(rawMessage, JsonOptions);
                if (@event is not null)
                {
                    await syncService.UpsertStudentSnapshotAsync(
                        @event.StudentId,
                        $"{@event.FirstName} {@event.LastName}",
                        @event.Email,
                        cancellationToken);
                }

                break;
            }
            case nameof(StudentUpdatedEvent):
            {
                var @event = JsonSerializer.Deserialize<StudentUpdatedEvent>(rawMessage, JsonOptions);
                if (@event is not null)
                {
                    await syncService.UpsertStudentSnapshotAsync(
                        @event.StudentId,
                        $"{@event.FirstName} {@event.LastName}",
                        @event.Email,
                        cancellationToken);
                }

                break;
            }
            case nameof(StudentDeletedEvent):
            {
                var @event = JsonSerializer.Deserialize<StudentDeletedEvent>(rawMessage, JsonOptions);
                if (@event is not null)
                {
                    await syncService.RemoveStudentSnapshotAsync(@event.StudentId, cancellationToken);
                }

                break;
            }
        }
    }
}
