using Common;
using EventContracts;
using Microsoft.EntityFrameworkCore;
using NotificationService.Data;
using NotificationService.Entities;

namespace NotificationService.Services;

public interface INotificationIngestService
{
    Task<bool> HandleEnrollmentEventAsync(EnrollmentEvent e, string queue, CancellationToken ct = default);
    Task<bool> HandleLowAvailabilityAsync(LowCourseAvailabilityEvent e, string queue, CancellationToken ct = default);
}

/// <summary>
/// Turns integration events into Pending notifications. The inbox row and the notification are written in ONE transaction: a redelivered
/// event (same EventId) is detected and skipped, and a crash can never leave only half of the work. Returns true when a new notification was created.
/// </summary>
public class NotificationIngestService(NotificationDbContext db, IConfiguration cfg, ILogger<NotificationIngestService> log) : INotificationIngestService
{
    public const string ConsumerGroup = "notification-service";

    public Task<bool> HandleEnrollmentEventAsync(EnrollmentEvent e, string queue, CancellationToken ct = default)
        => Idempotent(e.EventId, queue, async () =>
        {
            NotificationType? type = e.EventType switch
            {
                EventTypes.EnrollmentConfirmed => NotificationType.EnrollmentConfirmed,
                EventTypes.EnrollmentRejected => NotificationType.EnrollmentRejected,
                EventTypes.EnrollmentCancelled => NotificationType.EnrollmentCancelled,
                EventTypes.EnrollmentRequested => null,          // acknowledged (inbox row) but no user-facing notification
                _ => throw new InvalidOperationException("Unknown enrollment event type " + e.EventType),
            };
            if (type is null) { log.LogInformation("EnrollmentRequested recorded enrollment={EnrollmentId} (no notification)", e.EnrollmentId); return false; }
            if (await db.Notifications.AnyAsync(n => n.EnrollmentId == e.EnrollmentId && n.NotificationType == type, ct))
            { log.LogInformation("Notification already exists enrollment={EnrollmentId} type={Type}", e.EnrollmentId, type); return false; }
            db.Notifications.Add(new Notification
            {
                StudentId = e.StudentId, EnrollmentId = e.EnrollmentId, NotificationType = type.Value,
                RecipientEmail = e.StudentEmail, Message = Message(type.Value, e),
            });
            await db.SaveChangesAsync(ct);
            log.LogInformation("Notification queued type={Type} enrollment={EnrollmentId} student={StudentId}", type, e.EnrollmentId, e.StudentId);
            return true;
        }, ct);

    public Task<bool> HandleLowAvailabilityAsync(LowCourseAvailabilityEvent e, string queue, CancellationToken ct = default)
        => Idempotent(e.EventId, queue, async () =>
        {
            db.Notifications.Add(new Notification
            {
                NotificationType = NotificationType.CourseLowAvailability, RecipientEmail = cfg["Notification:AdminEmail"] ?? "admin@sms.local",
                Message = $"Course {e.CourseName} ({e.CourseCode}) is running low on seats: {e.AvailableSeats} of {e.TotalSeats} remaining.",
            });
            await db.SaveChangesAsync(ct);
            log.LogInformation("Low-availability notification queued course={CourseId} available={Available}", e.CourseId, e.AvailableSeats);
            return true;
        }, ct);

    /// <summary>Inbox pattern: skip if the message id was processed; otherwise record it and do the work in one transaction. A lost race on the unique index counts as a duplicate.</summary>
    private async Task<bool> Idempotent(string messageId, string queue, Func<Task<bool>> work, CancellationToken ct)
    {
        try
        {
            return await db.InTransactionAsync(async () =>
            {
                if (await db.InboxMessages.AnyAsync(m => m.MessageId == messageId && m.ConsumerGroup == ConsumerGroup, ct))
                { log.LogInformation("Duplicate message ignored messageId={MessageId}", messageId); return false; }
                db.InboxMessages.Add(new InboxMessage { MessageId = messageId, Queue = queue, ConsumerGroup = ConsumerGroup });
                await db.SaveChangesAsync(ct);
                return await work();
            }, ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException?.Message.Contains("Duplicate entry") == true)
        {
            log.LogInformation("Duplicate message ignored (concurrent delivery) messageId={MessageId}", messageId);
            return false;
        }
    }

    public static string Message(NotificationType type, EnrollmentEvent e)
    {
        var name = e.StudentName ?? "Student";
        var course = e.CourseName ?? $"course #{e.CourseId}";
        return type switch
        {
            NotificationType.EnrollmentConfirmed => $"Hi {name}, your enrollment #{e.EnrollmentId} in {course} is confirmed.",
            NotificationType.EnrollmentRejected => $"Hi {name}, your enrollment request for {course} was rejected" + (e.Reason is null ? "." : $": {e.Reason}"),
            NotificationType.EnrollmentCancelled => $"Hi {name}, your enrollment #{e.EnrollmentId} in {course} has been cancelled.",
            _ => throw new ArgumentException(type.ToString()),
        };
    }
}
