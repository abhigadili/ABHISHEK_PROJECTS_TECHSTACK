using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StudentMgmt.BuildingBlocks.Contracts;
using StudentMgmt.BuildingBlocks.Contracts.Events;
using StudentMgmt.BuildingBlocks.Messaging;
using StudentMgmt.NotificationService.Services.Interfaces;

namespace StudentMgmt.NotificationService.Kafka.Consumers;

/// <summary>
/// Subscribes to every upstream topic NotificationService cares about and
/// dispatches each event to <see cref="INotificationAppService.DeliverAsync"/>
/// with a channel/subject/body appropriate to that event type. All consume-loop,
/// retry and dead-lettering mechanics are owned by <see cref="KafkaConsumerBase"/>.
/// </summary>
public class UpstreamEventsConsumer : KafkaConsumerBase
{
    protected override string[] Topics { get; } =
    {
        KafkaTopics.StudentCreated,
        KafkaTopics.EnrollmentCreated,
        KafkaTopics.EnrollmentCancelled,
        KafkaTopics.NotificationRequested
    };

    public UpstreamEventsConsumer(
        IServiceProvider serviceProvider,
        IOptions<KafkaSettings> options,
        ILogger<UpstreamEventsConsumer> logger)
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
        var notificationAppService = scopedServiceProvider.GetRequiredService<INotificationAppService>();

        switch (eventType)
        {
            case nameof(StudentCreatedEvent):
            {
                var evt = JsonSerializer.Deserialize<StudentCreatedEvent>(rawMessage)
                    ?? throw new InvalidOperationException($"Failed to deserialize {nameof(StudentCreatedEvent)}.");

                await notificationAppService.DeliverAsync(
                    NotificationChannel.Email,
                    evt.Email,
                    null,
                    "Welcome to Student Management System",
                    $"Hi {evt.FirstName}, your enrollment number is {evt.EnrollmentNumber}.",
                    nameof(StudentCreatedEvent),
                    evt.StudentId,
                    cancellationToken);
                break;
            }

            case nameof(EnrollmentCreatedEvent):
            {
                var evt = JsonSerializer.Deserialize<EnrollmentCreatedEvent>(rawMessage)
                    ?? throw new InvalidOperationException($"Failed to deserialize {nameof(EnrollmentCreatedEvent)}.");

                await notificationAppService.DeliverAsync(
                    NotificationChannel.Email,
                    evt.StudentEmail,
                    null,
                    "Enrollment Confirmed",
                    $"You are now enrolled in {evt.CourseTitle}.",
                    nameof(EnrollmentCreatedEvent),
                    evt.EnrollmentId,
                    cancellationToken);
                break;
            }

            case nameof(EnrollmentCancelledEvent):
            {
                var evt = JsonSerializer.Deserialize<EnrollmentCancelledEvent>(rawMessage)
                    ?? throw new InvalidOperationException($"Failed to deserialize {nameof(EnrollmentCancelledEvent)}.");

                await notificationAppService.DeliverAsync(
                    NotificationChannel.Email,
                    evt.StudentEmail,
                    null,
                    "Enrollment Cancelled",
                    $"Your enrollment was cancelled: {evt.Reason}",
                    nameof(EnrollmentCancelledEvent),
                    evt.EnrollmentId,
                    cancellationToken);
                break;
            }

            case nameof(NotificationRequestedEvent):
            {
                var evt = JsonSerializer.Deserialize<NotificationRequestedEvent>(rawMessage)
                    ?? throw new InvalidOperationException($"Failed to deserialize {nameof(NotificationRequestedEvent)}.");

                await notificationAppService.DeliverAsync(
                    evt.Channel,
                    evt.RecipientEmail,
                    evt.RecipientPhoneNumber,
                    evt.Subject,
                    evt.Body,
                    evt.TriggeredByEvent,
                    evt.ReferenceId,
                    cancellationToken);
                break;
            }

            default:
                break;
        }
    }
}
