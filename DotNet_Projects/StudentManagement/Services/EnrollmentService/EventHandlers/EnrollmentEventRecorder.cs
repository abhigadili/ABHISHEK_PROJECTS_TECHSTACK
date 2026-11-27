using System.Text.Json;
using EnrollmentService.Data;
using EnrollmentService.Entities;
using EventContracts;
using Common.Web;

namespace EnrollmentService.EventHandlers;

public interface IEnrollmentEventRecorder
{
    void Record(string eventType, Enrollment e, string? reason, string? correlationId);
}

/// <summary>
/// Builds the integration event from an Enrollment and adds it to the outbox table. It only ADDS the row to the DbContext: the caller's
/// SaveChanges inside its local transaction persists it together with the business change. Calling it outside a transaction throws
/// (the .NET equivalent of "MANDATORY propagation"), which is what makes the outbox pattern atomic.
/// </summary>
public class EnrollmentEventRecorder(EnrollmentDbContext db, IHttpContextAccessor accessor) : IEnrollmentEventRecorder
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public void Record(string eventType, Enrollment e, string? reason, string? correlationId)
    {
        if (db.Database.CurrentTransaction is null) throw new InvalidOperationException("Outbox events must be recorded inside the business transaction");
        var cid = correlationId ?? CorrelationIdMiddleware.Current(accessor.HttpContext);
        var ev = new EnrollmentEvent(Guid.NewGuid().ToString(), eventType, e.EnrollmentId, e.StudentId, e.CourseId, e.StudentName, e.StudentEmail, e.CourseName, reason, cid, DateTimeOffset.UtcNow);
        db.Outbox.Add(new OutboxMessage
        {
            EventId = ev.EventId, AggregateId = e.EnrollmentId, EventType = eventType, RoutingKey = EventTypes.RoutingKey(eventType),
            Payload = JsonSerializer.Serialize(ev, Json), CorrelationId = cid,
        });
    }
}
