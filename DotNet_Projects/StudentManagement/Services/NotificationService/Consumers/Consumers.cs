using System.Text.Json;
using EventContracts;
using Messaging;
using NotificationService.Services;

namespace NotificationService.Consumers;

/// <summary>Consumes enrollment.* events. A thrown exception triggers the base class retry/back-off and finally dead-lettering to "...enrollment-events.dlq".</summary>
public class EnrollmentEventsConsumer(RabbitMqConnection conn, IServiceScopeFactory scopes, ILogger<EnrollmentEventsConsumer> log, IConfiguration cfg)
    : RabbitMqConsumer(conn, log, Topology.EnrollmentQueue, cfg.GetValue("Notification:ConsumerMaxAttempts", 4), TimeSpan.FromMilliseconds(cfg.GetValue("Notification:ConsumerRetryDelayMs", 1000)))
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    protected override async Task HandleAsync(string routingKey, string messageId, string eventType, string json, CancellationToken ct)
    {
        var e = JsonSerializer.Deserialize<EnrollmentEvent>(json, Json) ?? throw new InvalidOperationException("Empty enrollment event");
        using var scope = scopes.CreateScope();
        await scope.ServiceProvider.GetRequiredService<INotificationIngestService>().HandleEnrollmentEventAsync(e, Topology.EnrollmentQueue, ct);
    }
}

public class CourseEventsConsumer(RabbitMqConnection conn, IServiceScopeFactory scopes, ILogger<CourseEventsConsumer> log, IConfiguration cfg)
    : RabbitMqConsumer(conn, log, Topology.CourseQueue, cfg.GetValue("Notification:ConsumerMaxAttempts", 4), TimeSpan.FromMilliseconds(cfg.GetValue("Notification:ConsumerRetryDelayMs", 1000)))
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    protected override async Task HandleAsync(string routingKey, string messageId, string eventType, string json, CancellationToken ct)
    {
        var e = JsonSerializer.Deserialize<LowCourseAvailabilityEvent>(json, Json) ?? throw new InvalidOperationException("Empty course event");
        using var scope = scopes.CreateScope();
        await scope.ServiceProvider.GetRequiredService<INotificationIngestService>().HandleLowAvailabilityAsync(e, Topology.CourseQueue, ct);
    }
}
