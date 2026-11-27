using Common;
using Common.Caching;
using Common.Errors;
using CourseService.Data;
using CourseService.Dtos;
using CourseService.Entities;
using CourseService.Repositories;
using EventContracts;
using Messaging;

namespace CourseService.Services;

public interface ISeatService
{
    Task<SeatResponse> ReserveAsync(long courseId, long enrollmentId, CancellationToken ct = default);
    Task<SeatResponse> ReleaseAsync(long courseId, long enrollmentId, CancellationToken ct = default);
}

/// <summary>
/// Seat reservation / release. Overselling is prevented by an atomic conditional UPDATE (CourseRepository.TryReserveSeatAsync);
/// idempotency per enrollment is provided by the unique dn_seat_reservations.enrollment_id row.
/// </summary>
public class SeatService(CourseDbContext db, ICourseRepository repo, ICacheService cache, IEventPublisher publisher, IConfiguration cfg, ILogger<SeatService> log) : ISeatService
{
    private int Threshold => cfg.GetValue("Course:LowAvailabilityThreshold", 5);

    public async Task<SeatResponse> ReserveAsync(long courseId, long enrollmentId, CancellationToken ct = default)
    {
        Course? fresh = null;
        var result = await db.InTransactionAsync(async () =>
        {
            var course = await repo.FindReadOnlyAsync(courseId, ct) ?? throw new NotFoundException($"Course {courseId} not found");
            var existing = await repo.FindReservationAsync(enrollmentId, ct);
            if (existing != null)
            {
                if (existing.CourseId != courseId) throw new ConflictException($"Enrollment {enrollmentId} reserved a seat in another course");
                if (existing.Status == ReservationStatus.Released) throw new ConflictException($"Reservation for enrollment {enrollmentId} was already released");
                return new SeatResponse(courseId, enrollmentId, "Reserved", course.AvailableSeats, true);   // idempotent replay
            }
            if (await repo.TryReserveSeatAsync(courseId, ct) == 0)
                throw new ConflictException(course.Status != CourseStatus.Active ? $"Course {courseId} is not active" : $"No seats available in course {courseId}");
            await repo.AddReservationAsync(new SeatReservation { EnrollmentId = enrollmentId, CourseId = courseId, Status = ReservationStatus.Reserved }, ct);
            await repo.SaveAsync(ct);
            fresh = await repo.FindReadOnlyAsync(courseId, ct);
            return new SeatResponse(courseId, enrollmentId, "Reserved", fresh!.AvailableSeats, false);
        }, ct);

        if (!result.Replayed)
        {
            await Evict(courseId, ct);                       // after the commit
            log.LogInformation("Reserved seat course={CourseId} enrollment={EnrollmentId} remaining={Remaining}", courseId, enrollmentId, result.AvailableSeats);
            if (fresh!.AvailableSeats <= Threshold) PublishLowAvailability(fresh);
        }
        return result;
    }

    /// <summary>Idempotent: releasing an unknown or already-released reservation is a successful no-op.</summary>
    public async Task<SeatResponse> ReleaseAsync(long courseId, long enrollmentId, CancellationToken ct = default)
    {
        var result = await db.InTransactionAsync(async () =>
        {
            var course = await repo.FindReadOnlyAsync(courseId, ct) ?? throw new NotFoundException($"Course {courseId} not found");
            var r = await repo.FindReservationAsync(enrollmentId, ct);
            if (r is null || r.Status == ReservationStatus.Released) return new SeatResponse(courseId, enrollmentId, "Released", course.AvailableSeats, true);
            if (r.CourseId != courseId) throw new ConflictException($"Enrollment {enrollmentId} reserved a seat in another course");
            await repo.TryReleaseSeatAsync(courseId, ct);
            r.Status = ReservationStatus.Released;
            await repo.SaveAsync(ct);
            var fresh = await repo.FindReadOnlyAsync(courseId, ct);
            return new SeatResponse(courseId, enrollmentId, "Released", fresh!.AvailableSeats, false);
        }, ct);
        if (!result.Replayed)
        {
            await Evict(courseId, ct);
            log.LogInformation("Released seat course={CourseId} enrollment={EnrollmentId} available={Available}", courseId, enrollmentId, result.AvailableSeats);
        }
        return result;
    }

    private async Task Evict(long id, CancellationToken ct)
    { await cache.RemoveAsync(CourseAppService.CourseKey(id), ct); await cache.RemoveAsync(CourseAppService.AvailabilityKey(id), ct); }

    /// <summary>Best effort, after commit: a broker problem is logged and never fails the seat reservation.</summary>
    private void PublishLowAvailability(Course c)
    {
        try
        {
            var ev = new LowCourseAvailabilityEvent(Guid.NewGuid().ToString(), c.CourseId, c.CourseCode, c.CourseName, c.AvailableSeats, c.TotalSeats, DateTimeOffset.UtcNow);
            publisher.Publish(EventTypes.RoutingKey(EventTypes.LowCourseAvailability), ev.EventId, EventTypes.LowCourseAvailability,
                System.Text.Json.JsonSerializer.Serialize(ev, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web)));
        }
        catch (Exception e) { log.LogError("Failed to publish LowCourseAvailability for course {CourseId}: {Msg}", c.CourseId, e.Message); }
    }
}
