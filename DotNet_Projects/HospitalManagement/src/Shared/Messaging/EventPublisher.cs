using System.Text.Json;
using System.Text.Json.Serialization;
using HMS.Shared.Common;
using HMS.Shared.Data;

namespace HMS.Shared.Messaging;

public interface IEventPublisher
{
    /// <summary>Stages the event in the outbox of the current DbContext. It is committed (and later relayed to Kafka) by the caller's SaveChangesAsync - never before.</summary>
    void Publish(string topic, string key, IntegrationEvent evt);
}

public sealed class EventPublisher(ServiceDbContext db) : IEventPublisher
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter()  , new HMS.Shared.Common.FlexibleTimeOnlyConverter() } };

    public void Publish(string topic, string key, IntegrationEvent evt) =>
        db.Outbox.Add(new OutboxMessage
        {
            Topic = topic,
            Key = key,
            EventType = evt.GetType().Name,
            Payload = JsonSerializer.Serialize(evt, evt.GetType(), Json),
            CorrelationId = CorrelationContext.Id
        });
}
