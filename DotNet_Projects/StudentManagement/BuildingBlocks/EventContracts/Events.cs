namespace EventContracts;

/// <summary>Integration event published by Enrollment Service. EventId is the idempotency key for consumers. Independent of any EF entity.</summary>
public record EnrollmentEvent(
    string EventId, string EventType, long EnrollmentId, long StudentId, long CourseId,
    string? StudentName, string? StudentEmail, string? CourseName, string? Reason,
    string? CorrelationId, DateTimeOffset OccurredAt);

/// <summary>Published by Course Service when available seats fall to/below the configured threshold.</summary>
public record LowCourseAvailabilityEvent(
    string EventId, long CourseId, string CourseCode, string CourseName, int AvailableSeats, int TotalSeats, DateTimeOffset OccurredAt);

public static class EventTypes
{
    public const string EnrollmentRequested = "EnrollmentRequested";
    public const string EnrollmentConfirmed = "EnrollmentConfirmed";
    public const string EnrollmentRejected = "EnrollmentRejected";
    public const string EnrollmentCancelled = "EnrollmentCancelled";
    public const string LowCourseAvailability = "LowCourseAvailability";

    /// <summary>Event type → RabbitMQ routing key.</summary>
    public static string RoutingKey(string eventType) => eventType switch
    {
        EnrollmentRequested => "enrollment.requested",
        EnrollmentConfirmed => "enrollment.confirmed",
        EnrollmentRejected => "enrollment.rejected",
        EnrollmentCancelled => "enrollment.cancelled",
        LowCourseAvailability => "course.low-availability",
        _ => throw new ArgumentException("Unknown event type " + eventType),
    };
}

/// <summary>Broker topology names shared by publishers and consumers.</summary>
public static class Topology
{
    public const string Exchange = "sms.events";                    // topic, durable
    public const string DeadLetterExchange = "sms.events.dlx";      // direct, durable
    public const string EnrollmentQueue = "notification.enrollment-events";
    public const string CourseQueue = "notification.course-events";
    public const string EnrollmentBinding = "enrollment.*";
    public const string CourseBinding = "course.*";
    public static string DeadLetterQueue(string queue) => queue + ".dlq";
}
