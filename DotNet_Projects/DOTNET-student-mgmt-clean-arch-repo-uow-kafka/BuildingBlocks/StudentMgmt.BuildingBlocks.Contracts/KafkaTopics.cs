namespace StudentMgmt.BuildingBlocks.Contracts;

/// <summary>
/// Single source of truth for Kafka topic names so producers and consumers
/// across all four services never drift apart on a typo'd string literal.
/// </summary>
public static class KafkaTopics
{
    public const string StudentCreated = "student.created";
    public const string StudentUpdated = "student.updated";
    public const string StudentDeleted = "student.deleted";

    public const string CourseCreated = "course.created";
    public const string CourseUpdated = "course.updated";
    public const string CourseDeleted = "course.deleted";

    public const string EnrollmentCreated = "enrollment.created";
    public const string EnrollmentCancelled = "enrollment.cancelled";

    public const string NotificationRequested = "notification.requested";
    public const string NotificationSent = "notification.sent";

    /// <summary>
    /// Every "&lt;topic&gt;" gets a matching "&lt;topic&gt;.dlq" that poison messages
    /// (ones that keep failing after every retry) are redirected to instead of being
    /// dropped or blocking the partition forever.
    /// </summary>
    public static string DeadLetterFor(string topic) => $"{topic}.dlq";
}
