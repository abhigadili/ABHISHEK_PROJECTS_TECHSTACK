using Common;
using Common.Errors;
using EnrollmentService.Clients;
using EnrollmentService.Data;
using EnrollmentService.Entities;
using EnrollmentService.EventHandlers;
using EventContracts;
using Microsoft.EntityFrameworkCore;

namespace EnrollmentService.Saga;

/// <summary>Thrown by a saga step when progress must wait (dependency down): the saga stays persisted and SagaRecoveryJob resumes it.</summary>
public class SagaPausedException(string message, Exception? inner = null) : Exception(message, inner);

/// <summary>
/// Orchestration-based enrollment saga. The state is persisted after EVERY step (dn_saga_instances), remote calls happen OUTSIDE database
/// transactions, and each step is idempotent, so Run(sagaId) can be called again after a crash and continues from the persisted state.
/// <code>
/// Started → StudentValidated → CourseValidated → PendingCreated → SeatReserved → Completed
///   any failure ↓                                      failure ↓
///   Compensating (release seat if any, create/mark enrollment Rejected, publish EnrollmentRejected) → Rejected
/// </code>
/// </summary>
public class EnrollmentSagaOrchestrator(EnrollmentDbContext db, IStudentClient students, ICourseClient courses, IEnrollmentEventRecorder events, ILogger<EnrollmentSagaOrchestrator> log)
{
    /// <summary>Creates the saga (idempotent on the key), runs it to completion (or pause) and returns the final persisted state.</summary>
    public async Task<SagaInstance> StartAsync(string idempotencyKey, long studentId, long courseId, string? correlationId, CancellationToken ct = default)
    {
        var existing = await db.Sagas.AsNoTracking().FirstOrDefaultAsync(s => s.IdempotencyKey == idempotencyKey, ct);
        if (existing != null) { log.LogInformation("Idempotent replay of enrollment request key={Key} state={State}", idempotencyKey, existing.State); return existing; }
        var s = new SagaInstance { IdempotencyKey = idempotencyKey, StudentId = studentId, CourseId = courseId, CorrelationId = correlationId };
        db.Sagas.Add(s);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException)      // concurrent request with the same key won the race
        {
            db.ChangeTracker.Clear();
            return await db.Sagas.AsNoTracking().FirstAsync(x => x.IdempotencyKey == idempotencyKey, ct);
        }
        return await RunAsync(s.SagaId, ct);
    }

    /// <summary>Drives the saga until it is terminal or paused. Safe to call repeatedly.</summary>
    public async Task<SagaInstance> RunAsync(long sagaId, CancellationToken ct = default)
    {
        db.ChangeTracker.Clear();
        var s = await db.Sagas.FirstAsync(x => x.SagaId == sagaId, ct);
        Clients.SagaCorrelation.Current = s.CorrelationId;
        for (var guard = 0; !s.State.IsTerminal() && guard < 12; guard++)
        {
            try { s = await StepAsync(s, ct); }
            catch (SagaPausedException paused)
            {
                log.LogWarning("Saga {SagaId} paused in {State}: {Msg}", sagaId, s.State, paused.Message);
                s.Attempts++; await db.SaveChangesAsync(ct);
                return s;
            }
        }
        return s;
    }

    private Task<SagaInstance> StepAsync(SagaInstance s, CancellationToken ct)
    {
        log.LogInformation("Saga {SagaId} step {State} (enrollment={EnrollmentId}, student={StudentId}, course={CourseId})", s.SagaId, s.State, s.EnrollmentId, s.StudentId, s.CourseId);
        return s.State switch
        {
            SagaState.Started => ValidateStudent(s, ct),
            SagaState.StudentValidated => ValidateCourse(s, ct),
            SagaState.CourseValidated => CreatePendingEnrollment(s, ct),
            SagaState.PendingCreated => ReserveSeat(s, ct),
            SagaState.SeatReserved => Confirm(s, ct),
            SagaState.Compensating => Compensate(s, ct),
            _ => Task.FromResult(s),
        };
    }

    // ---- step 2: validate the student through Student Service -------------------------------------------------------------
    private async Task<SagaInstance> ValidateStudent(SagaInstance s, CancellationToken ct)
    {
        try
        {
            var elig = await students.EligibilityAsync(s.StudentId, ct);
            if (!elig.Eligible) return await Fail(s, $"Student is not eligible: {elig.Reason}", ct);
            var info = await students.GetAsync(s.StudentId, ct);
            s.StudentName = info.FullName; s.StudentEmail = info.Email; s.State = SagaState.StudentValidated;
            return await Save(s, ct);
        }
        catch (RemoteNotFoundException) { return await Fail(s, $"Student {s.StudentId} does not exist", ct); }
        catch (Exception e) when (e is RemoteRejectedException or RemoteConflictException or ServiceUnavailableException) { return await Fail(s, $"Student validation failed: {e.Message}", ct); }
    }

    // ---- step 3: validate the course through Course Service ---------------------------------------------------------------
    private async Task<SagaInstance> ValidateCourse(SagaInstance s, CancellationToken ct)
    {
        try
        {
            var course = await courses.GetAsync(s.CourseId, ct);
            if (!string.Equals(course.Status, "Active", StringComparison.OrdinalIgnoreCase)) return await Fail(s, $"Course {s.CourseId} is not active", ct);
            var availability = await courses.AvailabilityAsync(s.CourseId, ct);
            if (!availability.Available) return await Fail(s, $"No seats available in course {s.CourseId}", ct);
            s.CourseName = course.CourseName; s.State = SagaState.CourseValidated;
            return await Save(s, ct);
        }
        catch (RemoteNotFoundException) { return await Fail(s, $"Course {s.CourseId} does not exist", ct); }
        catch (Exception e) when (e is RemoteRejectedException or RemoteConflictException or ServiceUnavailableException) { return await Fail(s, $"Course validation failed: {e.Message}", ct); }
    }

    // ---- step 4: Pending enrollment + EnrollmentRequested in ONE local transaction (outbox) -------------------------------
    private async Task<SagaInstance> CreatePendingEnrollment(SagaInstance s, CancellationToken ct)
    {
        try
        {
            await db.InTransactionAsync(async () =>
            {
                var sagaRow = await db.Sagas.FirstAsync(x => x.SagaId == s.SagaId, ct);
                var e = await db.Enrollments.FirstOrDefaultAsync(x => x.IdempotencyKey == s.IdempotencyKey, ct);
                if (e == null)
                {
                    e = new Enrollment
                    {
                        StudentId = s.StudentId, CourseId = s.CourseId, StudentName = s.StudentName, StudentEmail = s.StudentEmail, CourseName = s.CourseName,
                        Status = EnrollmentStatus.Pending, IdempotencyKey = s.IdempotencyKey,
                    };
                    db.Enrollments.Add(e);
                    await db.SaveChangesAsync(ct);          // unique(ActiveKey): a duplicate active enrollment fails here
                    events.Record(EventTypes.EnrollmentRequested, e, null, s.CorrelationId);
                }
                sagaRow.EnrollmentId = e.EnrollmentId; sagaRow.State = SagaState.PendingCreated;
                await db.SaveChangesAsync(ct);
                return true;
            }, ct);
            return await Reload(s.SagaId, ct);
        }
        catch (DbUpdateException)
        {
            db.ChangeTracker.Clear();
            s = await Reload(s.SagaId, ct);
            return await Fail(s, $"Student {s.StudentId} already has an active enrollment in course {s.CourseId}", ct);
        }
    }

    // ---- step 5: reserve a seat (idempotent per enrollmentId in Course Service) -------------------------------------------
    private async Task<SagaInstance> ReserveSeat(SagaInstance s, CancellationToken ct)
    {
        try
        {
            await courses.ReserveSeatAsync(s.CourseId, s.EnrollmentId!.Value, ct);
            s.SeatReserved = true; s.State = SagaState.SeatReserved;
            return await Save(s, ct);
        }
        catch (RemoteConflictException) { return await Fail(s, "Seat reservation failed: no seats available", ct); }
        catch (Exception e) when (e is RemoteNotFoundException or RemoteRejectedException or ServiceUnavailableException) { return await Fail(s, $"Seat reservation failed: {e.Message}", ct); }
    }

    // ---- steps 6/7: confirm + EnrollmentConfirmed in ONE local transaction -------------------------------------------------
    private async Task<SagaInstance> Confirm(SagaInstance s, CancellationToken ct)
    {
        try
        {
            await db.InTransactionAsync(async () =>
            {
                var e = await db.Enrollments.FirstAsync(x => x.EnrollmentId == s.EnrollmentId, ct);
                if (e.Status == EnrollmentStatus.Pending)
                {
                    e.TransitionTo(EnrollmentStatus.Confirmed);
                    await db.SaveChangesAsync(ct);
                    events.Record(EventTypes.EnrollmentConfirmed, e, null, s.CorrelationId);
                }
                var sagaRow = await db.Sagas.FirstAsync(x => x.SagaId == s.SagaId, ct);
                sagaRow.State = SagaState.Completed;
                await db.SaveChangesAsync(ct);
                return true;
            }, ct);
            return await Reload(s.SagaId, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            log.LogError("Saga {SagaId} could not confirm enrollment {EnrollmentId}: {Msg}", s.SagaId, s.EnrollmentId, ex.Message);
            db.ChangeTracker.Clear();
            s = await Reload(s.SagaId, ct);
            return await Fail(s, $"Enrollment could not be confirmed: {ex.Message}", ct);   // the seat is released by Compensate()
        }
    }

    // ---- compensation -------------------------------------------------------------------------------------------------------
    private async Task<SagaInstance> Fail(SagaInstance s, string reason, CancellationToken ct)
    {
        log.LogWarning("Saga {SagaId} failed in {State}: {Reason}", s.SagaId, s.State, reason);
        s.FailureReason = reason.Length > 500 ? reason[..500] : reason;
        s.State = SagaState.Compensating;
        return await Save(s, ct);
    }

    private async Task<SagaInstance> Compensate(SagaInstance s, CancellationToken ct)
    {
        if (s.EnrollmentId != null)
        {
            try { await courses.ReleaseSeatAsync(s.CourseId, s.EnrollmentId.Value, ct); }   // idempotent: a no-op when no seat was reserved
            catch (Exception e) when (e is RemoteNotFoundException or RemoteConflictException or RemoteRejectedException) { /* nothing to release */ }
            catch (ServiceUnavailableException e) { throw new SagaPausedException("seat release pending, course-service unavailable", e); }   // retried by SagaRecoveryJob
        }
        await db.InTransactionAsync(async () =>
        {
            var sagaRow = await db.Sagas.FirstAsync(x => x.SagaId == s.SagaId, ct);
            var e = sagaRow.EnrollmentId == null ? null : await db.Enrollments.FirstOrDefaultAsync(x => x.EnrollmentId == sagaRow.EnrollmentId, ct);
            if (e == null)
            {
                e = new Enrollment
                {
                    StudentId = s.StudentId, CourseId = s.CourseId, StudentName = s.StudentName, StudentEmail = s.StudentEmail, CourseName = s.CourseName,
                    Status = EnrollmentStatus.Rejected, IdempotencyKey = s.IdempotencyKey, Remarks = s.FailureReason,
                };
                db.Enrollments.Add(e);
                await db.SaveChangesAsync(ct);
                events.Record(EventTypes.EnrollmentRejected, e, s.FailureReason, s.CorrelationId);
            }
            else if (e.Status == EnrollmentStatus.Pending)
            {
                e.TransitionTo(EnrollmentStatus.Rejected);
                e.Remarks = s.FailureReason;
                await db.SaveChangesAsync(ct);
                events.Record(EventTypes.EnrollmentRejected, e, s.FailureReason, s.CorrelationId);
            }
            sagaRow.EnrollmentId = e.EnrollmentId; sagaRow.SeatReserved = false; sagaRow.State = SagaState.Rejected;
            await db.SaveChangesAsync(ct);
            return true;
        }, ct);
        return await Reload(s.SagaId, ct);
    }

    private async Task<SagaInstance> Save(SagaInstance s, CancellationToken ct) { await db.SaveChangesAsync(ct); return s; }
    private async Task<SagaInstance> Reload(long id, CancellationToken ct) { db.ChangeTracker.Clear(); return await db.Sagas.FirstAsync(x => x.SagaId == id, ct); }
}

/// <summary>Resumes sagas that stopped making progress (service restart, dependency outage) from their persisted state.</summary>
public class SagaRecoveryJob(IServiceScopeFactory scopes, IConfiguration cfg, ILogger<SagaRecoveryJob> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        var every = TimeSpan.FromMilliseconds(cfg.GetValue("Saga:RecoveryIntervalMs", 15000));
        var staleAfter = TimeSpan.FromSeconds(cfg.GetValue("Saga:StaleAfterSeconds", 30));
        using var timer = new PeriodicTimer(every);
        while (await timer.WaitForNextTickAsync(stop))
        {
            try { await RecoverOnceAsync(staleAfter, stop); }
            catch (Exception e) when (e is not OperationCanceledException) { log.LogError("Saga recovery poll failed: {Msg}", e.Message); }
        }
    }

    public async Task<int> RecoverOnceAsync(TimeSpan staleAfter, CancellationToken ct)
    {
        List<long> stuck;
        using (var scope = scopes.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<EnrollmentDbContext>();
            var cutoff = DateTime.UtcNow - staleAfter;
            stuck = await db.Sagas.AsNoTracking().Where(s => s.State != SagaState.Completed && s.State != SagaState.Rejected && s.UpdatedAt < cutoff)
                .OrderBy(s => s.UpdatedAt).Take(50).Select(s => s.SagaId).ToListAsync(ct);
        }
        foreach (var id in stuck)
        {
            try
            {
                log.LogWarning("Recovering saga {SagaId}", id);
                using var scope = scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<EnrollmentSagaOrchestrator>().RunAsync(id, ct);
            }
            catch (DbUpdateConcurrencyException) { log.LogInformation("Saga {SagaId} is being handled by another worker", id); }
            catch (Exception e) when (e is not OperationCanceledException) { log.LogError("Recovery of saga {SagaId} failed: {Msg}", id, e.Message); }
        }
        return stuck.Count;
    }
}
