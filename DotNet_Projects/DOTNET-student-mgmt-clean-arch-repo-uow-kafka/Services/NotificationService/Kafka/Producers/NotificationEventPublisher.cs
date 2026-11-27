using StudentMgmt.BuildingBlocks.Contracts;
using StudentMgmt.BuildingBlocks.Contracts.Events;
using StudentMgmt.BuildingBlocks.Messaging;
using StudentMgmt.NotificationService.Entities;

namespace StudentMgmt.NotificationService.Kafka.Producers;

/// <summary>
/// Wraps <see cref="IEventProducer"/> to publish the outcome of every notification
/// NotificationService handles, so upstream services/auditors can react to
/// delivery success/failure without polling this service's REST API.
/// </summary>
public class NotificationEventPublisher
{
    private readonly IEventProducer _eventProducer;

    public NotificationEventPublisher(IEventProducer eventProducer)
    {
        _eventProducer = eventProducer;
    }

    public async Task PublishNotificationSentAsync(NotificationHistory history, CancellationToken cancellationToken = default)
    {
        var @event = new NotificationSentEvent
        {
            NotificationId = history.Id,
            Channel = history.Channel,
            RecipientEmail = history.RecipientEmail,
            Success = history.Success,
            FailureReason = history.FailureReason,
            SentOnUtc = history.SentOnUtc
        };

        await _eventProducer.PublishAsync(KafkaTopics.NotificationSent, @event, cancellationToken);
    }
}
