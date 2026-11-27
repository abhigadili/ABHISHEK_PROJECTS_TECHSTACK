using Common;
using Common.Errors;
using EnrollmentService.Clients;
using EnrollmentService.Data;
using EnrollmentService.Dtos;
using EnrollmentService.Entities;
using EnrollmentService.EventHandlers;
using EnrollmentService.Saga;
using EventContracts;
using Microsoft.EntityFrameworkCore;

namespace EnrollmentService.Commands;

// ---- write side of CQRS: command objects + one handler each ----------------------------------------------------------------
/// <summary>Request an enrollment. IdempotencyKey makes retries of the same request return the same result.</summary>
public record CreateEnrollmentCommand(long StudentId, long CourseId, string IdempotencyKey, string? CorrelationId);
public record CancelEnrollmentCommand(long EnrollmentId, string? Reason);
public record UpdateEnrollmentCommand(long EnrollmentId, string? Remarks);

public class CreateEnrollmentCommandHandler(EnrollmentSagaOrchestrator saga, EnrollmentDbContext db)
{
    public async Task<EnrollmentOutcome> HandleAsync(CreateEnrollmentCommand cmd, CancellationToken ct = default)
    {
        // Replays of the same idempotency key skip the duplicate check and return the stored result.
        var replay = await db.Sagas.AsNoTracking().AnyAsync(s => s.IdempotencyKey == cmd.IdempotencyKey, ct);
        if (!replay && await db.Enrollments.AsNoTracking().AnyAsync(e => e.StudentId == cmd.StudentId && e.CourseId == cmd.CourseId
                && (e.Status == EnrollmentStatus.Pending || e.Status == EnrollmentStatus.Confirmed), ct))
            throw new ConflictException($"Student {cmd.StudentId} already has an active enrollment in course {cmd.CourseId}");

        var s = await saga.StartAsync(cmd.IdempotencyKey, cmd.StudentId, cmd.CourseId, cmd.CorrelationId, ct);
        db.ChangeTracker.Clear();
        var e = s.EnrollmentId == null ? null : await db.Enrollments.AsNoTracking().FirstOrDefaultAsync(x => x.EnrollmentId == s.EnrollmentId, ct);
        var dto = e == null ? null : EnrollmentResponse.From(e);
        return s.State switch
        {
            SagaState.Completed => new EnrollmentOutcome(EnrollmentOutcome.Confirmed, "Enrollment confirmed", dto),
            SagaState.Rejected => new EnrollmentOutcome(EnrollmentOutcome.Rejected, s.FailureReason ?? "Rejected", dto),
            _ => new EnrollmentOutcome(EnrollmentOutcome.InProgress, $"Enrollment is being processed (state {s.State})", dto),
        };
    }
}

/// <summary>
/// Cancels a Confirmed enrollment: (1) releases the seat in Course Service (idempotent), then (2) in one local transaction marks it Cancelled
/// and stores EnrollmentCancelled in the outbox. If step 1 fails nothing changes and the caller may simply retry.
/// </summary>
public class CancelEnrollmentCommandHandler(EnrollmentDbContext db, ICourseClient courses, IEnrollmentEventRecorder events, ILogger<CancelEnrollmentCommandHandler> log)
{
    public async Task<EnrollmentResponse> HandleAsync(CancelEnrollmentCommand cmd, CancellationToken ct = default)
    {
        var e = await db.Enrollments.AsNoTracking().FirstOrDefaultAsync(x => x.EnrollmentId == cmd.EnrollmentId, ct)
            ?? throw new NotFoundException($"Enrollment {cmd.EnrollmentId} not found");
        if (e.Status == EnrollmentStatus.Pending) throw new ConflictException($"Enrollment {e.EnrollmentId} is still being processed; retry shortly");
        if (e.Status != EnrollmentStatus.Confirmed) throw new BusinessRuleException($"Only Confirmed enrollments can be cancelled (current: {e.Status})");

        try { await courses.ReleaseSeatAsync(e.CourseId, e.EnrollmentId, ct); }
        catch (Exception ex) when (ex is RemoteNotFoundException or RemoteConflictException)
        { log.LogWarning("Seat release for enrollment {EnrollmentId} reported nothing to release", e.EnrollmentId); }

        return await db.InTransactionAsync(async () =>
        {
            var fresh = await db.Enrollments.FirstAsync(x => x.EnrollmentId == cmd.EnrollmentId, ct);
            fresh.TransitionTo(EnrollmentStatus.Cancelled);
            if (cmd.Reason != null) fresh.Remarks = cmd.Reason;
            await db.SaveChangesAsync(ct);
            events.Record(EventTypes.EnrollmentCancelled, fresh, cmd.Reason, null);
            await db.SaveChangesAsync(ct);
            log.LogInformation("Enrollment {EnrollmentId} cancelled", fresh.EnrollmentId);
            return EnrollmentResponse.From(fresh);
        }, ct);
    }
}

/// <summary>Status changes are owned by the saga / cancel command (see the EnrollmentStatus state machine); staff can only annotate.</summary>
public class UpdateEnrollmentCommandHandler(EnrollmentDbContext db)
{
    public async Task<EnrollmentResponse> HandleAsync(UpdateEnrollmentCommand cmd, CancellationToken ct = default)
    {
        var e = await db.Enrollments.FirstOrDefaultAsync(x => x.EnrollmentId == cmd.EnrollmentId, ct) ?? throw new NotFoundException($"Enrollment {cmd.EnrollmentId} not found");
        e.Remarks = cmd.Remarks;
        await db.SaveChangesAsync(ct);
        return EnrollmentResponse.From(e);
    }
}
