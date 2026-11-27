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
/// Consumes CourseService's own lifecycle events and mirrors just the fields
/// EnrollmentService needs into the local CourseSnapshot read model. This is the
/// only mechanism by which EnrollmentService learns anything about a course —
/// per Database-per-Service it must never query CourseDotnetDB directly.
/// </summary>
public class CourseEventsConsumer : KafkaConsumerBase
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    protected override string[] Topics => new[]
    {
        KafkaTopics.CourseCreated,
        KafkaTopics.CourseUpdated,
        KafkaTopics.CourseDeleted
    };

    public CourseEventsConsumer(IServiceProvider serviceProvider, IOptions<KafkaSettings> options, ILogger<CourseEventsConsumer> logger)
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
            case nameof(CourseCreatedEvent):
            {
                var @event = JsonSerializer.Deserialize<CourseCreatedEvent>(rawMessage, JsonOptions);
                if (@event is not null)
                {
                    await syncService.UpsertCourseSnapshotAsync(@event.CourseId, @event.Title, @event.Capacity, cancellationToken);
                }

                break;
            }
            case nameof(CourseUpdatedEvent):
            {
                var @event = JsonSerializer.Deserialize<CourseUpdatedEvent>(rawMessage, JsonOptions);
                if (@event is not null)
                {
                    await syncService.UpsertCourseSnapshotAsync(@event.CourseId, @event.Title, @event.Capacity, cancellationToken);
                }

                break;
            }
            case nameof(CourseDeletedEvent):
            {
                var @event = JsonSerializer.Deserialize<CourseDeletedEvent>(rawMessage, JsonOptions);
                if (@event is not null)
                {
                    await syncService.RemoveCourseSnapshotAsync(@event.CourseId, cancellationToken);
                }

                break;
            }
        }
    }
}
