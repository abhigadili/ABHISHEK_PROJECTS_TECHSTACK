using Common.Errors;
using Common.Paging;
using EnrollmentService.Clients;
using EnrollmentService.Commands;
using EnrollmentService.Data;
using EnrollmentService.Dtos;
using EnrollmentService.Entities;
using EnrollmentService.EventHandlers;
using EnrollmentService.Queries;
using EnrollmentService.Saga;
using EventContracts;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace UnitTests.EnrollmentTests;

public abstract class SagaFixture
{
    protected readonly Mock<IStudentClient> Students = new();
    protected readonly Mock<ICourseClient> Courses = new();
    protected readonly Mock<IEnrollmentEventRecorder> Events = new();
    protected readonly List<string> Recorded = new();
    protected readonly EnrollmentDbContext Db = new(new DbContextOptionsBuilder<EnrollmentDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString())
        .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)).Options);

    protected SagaFixture()
    {
        Events.Setup(e => e.Record(It.IsAny<string>(), It.IsAny<EnrollmentService.Entities.Enrollment>(), It.IsAny<string?>(), It.IsAny<string?>()))
            .Callback<string, EnrollmentService.Entities.Enrollment, string?, string?>((t, _, _, _) => Recorded.Add(t));
        Students.Setup(s => s.EligibilityAsync(1, default)).ReturnsAsync(new EligibilityInfo(1, true, null));
        Students.Setup(s => s.GetAsync(1, default)).ReturnsAsync(new StudentInfo(1, "Asha", "Rao", "asha@example.com", "Active"));
        Courses.Setup(c => c.GetAsync(5, default)).ReturnsAsync(new CourseInfo(5, "Java", "JV-1", "Active", 30, 10));
        Courses.Setup(c => c.AvailabilityAsync(5, default)).ReturnsAsync(new AvailabilityInfo(5, "Active", 30, 10, true));
        Courses.Setup(c => c.ReserveSeatAsync(5, It.IsAny<long>(), default)).ReturnsAsync((long c, long e, CancellationToken _) => new SeatResult(c, e, "Reserved", 9, false));
        Courses.Setup(c => c.ReleaseSeatAsync(5, It.IsAny<long>(), default)).ReturnsAsync((long c, long e, CancellationToken _) => new SeatResult(c, e, "Released", 10, false));
    }

    protected EnrollmentSagaOrchestrator Saga() => new(Db, Students.Object, Courses.Object, Events.Object, NullLogger<EnrollmentSagaOrchestrator>.Instance);
}

public class EnrollmentSagaTests : SagaFixture
{
    [Fact]
    public async Task Happy_path_confirms_the_enrollment_and_publishes_requested_then_confirmed()
    {
        var s = await Saga().StartAsync("k1", 1, 5, "corr-1");
        Assert.Equal(SagaState.Completed, s.State);
        var e = await Db.Enrollments.AsNoTracking().SingleAsync();
        Assert.Equal(EnrollmentStatus.Confirmed, e.Status);
        Assert.Equal("Asha Rao", e.StudentName); Assert.Equal("Java", e.CourseName);
        Assert.Equal(new[] { EventTypes.EnrollmentRequested, EventTypes.EnrollmentConfirmed }, Recorded);
        Courses.Verify(c => c.ReserveSeatAsync(5, e.EnrollmentId, default), Times.Once);
    }

    [Fact]
    public async Task Unknown_student_rejects_without_touching_the_course()
    {
        Students.Setup(x => x.EligibilityAsync(9, default)).ThrowsAsync(new RemoteNotFoundException("404"));
        var s = await Saga().StartAsync("k2", 9, 5, null);
        Assert.Equal(SagaState.Rejected, s.State); Assert.Contains("does not exist", s.FailureReason);
        Courses.Verify(c => c.ReserveSeatAsync(It.IsAny<long>(), It.IsAny<long>(), default), Times.Never);
        Assert.Equal(new[] { EventTypes.EnrollmentRejected }, Recorded);
        Assert.Equal(EnrollmentStatus.Rejected, (await Db.Enrollments.SingleAsync()).Status);
    }

    [Fact]
    public async Task Inactive_student_is_rejected_with_the_reason()
    {
        Students.Setup(x => x.EligibilityAsync(1, default)).ReturnsAsync(new EligibilityInfo(1, false, "Student is Inactive"));
        var s = await Saga().StartAsync("k3", 1, 5, null);
        Assert.Equal(SagaState.Rejected, s.State); Assert.Contains("not eligible", s.FailureReason);
    }

    [Fact]
    public async Task Inactive_or_full_course_is_rejected_before_anything_is_reserved()
    {
        Courses.Setup(c => c.GetAsync(5, default)).ReturnsAsync(new CourseInfo(5, "Java", "JV-1", "Inactive", 30, 10));
        Assert.Contains("not active", (await Saga().StartAsync("k4", 1, 5, null)).FailureReason);
        Courses.Setup(c => c.GetAsync(5, default)).ReturnsAsync(new CourseInfo(5, "Java", "JV-1", "Active", 30, 0));
        Courses.Setup(c => c.AvailabilityAsync(5, default)).ReturnsAsync(new AvailabilityInfo(5, "Active", 30, 0, false));
        Assert.Contains("No seats", (await Saga().StartAsync("k5", 1, 5, null)).FailureReason);
    }

    [Fact]
    public async Task Student_service_outage_rejects_with_validation_failed()
    {
        Students.Setup(x => x.EligibilityAsync(1, default)).ThrowsAsync(new ServiceUnavailableException("student-service circuit breaker is OPEN"));
        var s = await Saga().StartAsync("k6", 1, 5, null);
        Assert.Equal(SagaState.Rejected, s.State); Assert.Contains("Student validation failed", s.FailureReason);
    }

    [Fact]
    public async Task Seat_reservation_failure_compensates_releases_the_seat_and_rejects()
    {
        Courses.Setup(c => c.ReserveSeatAsync(5, It.IsAny<long>(), default)).ThrowsAsync(new RemoteConflictException("409 no seats"));
        var s = await Saga().StartAsync("k7", 1, 5, null);
        Assert.Equal(SagaState.Rejected, s.State); Assert.Contains("no seats", s.FailureReason);
        var e = await Db.Enrollments.SingleAsync();
        Assert.Equal(EnrollmentStatus.Rejected, e.Status);
        Courses.Verify(c => c.ReleaseSeatAsync(5, e.EnrollmentId, default), Times.Once);   // compensating action (idempotent no-op at Course Service)
        Assert.Equal(new[] { EventTypes.EnrollmentRequested, EventTypes.EnrollmentRejected }, Recorded);
    }

    [Fact]
    public async Task Failure_after_seat_reservation_releases_the_reserved_seat()
    {
        // seat reserved OK, then confirming blows up (the confirmed event recorder throws) → saga must give the seat back
        Events.Setup(e => e.Record(EventTypes.EnrollmentConfirmed, It.IsAny<EnrollmentService.Entities.Enrollment>(), It.IsAny<string?>(), It.IsAny<string?>())).Throws(new InvalidOperationException("outbox write failed"));
        var s = await Saga().StartAsync("k8", 1, 5, null);
        Assert.Equal(SagaState.Rejected, s.State); Assert.Contains("could not be confirmed", s.FailureReason);
        var e = await Db.Enrollments.SingleAsync();
        Courses.Verify(c => c.ReserveSeatAsync(5, e.EnrollmentId, default), Times.Once);
        Courses.Verify(c => c.ReleaseSeatAsync(5, e.EnrollmentId, default), Times.Once);
    }

    [Fact]
    public async Task Compensation_pauses_when_course_service_is_unavailable_and_recovery_completes_it()
    {
        Courses.Setup(c => c.ReserveSeatAsync(5, It.IsAny<long>(), default)).ThrowsAsync(new RemoteConflictException("409"));
        Courses.Setup(c => c.ReleaseSeatAsync(5, It.IsAny<long>(), default)).ThrowsAsync(new ServiceUnavailableException("down"));
        var s = await Saga().StartAsync("k9", 1, 5, null);
        Assert.Equal(SagaState.Compensating, s.State); Assert.True(s.Attempts >= 1);   // paused, persisted, NOT lost

        Courses.Setup(c => c.ReleaseSeatAsync(5, It.IsAny<long>(), default)).ReturnsAsync((long c, long e, CancellationToken _) => new SeatResult(c, e, "Released", 10, false));
        var resumed = await Saga().RunAsync(s.SagaId);   // what SagaRecoveryJob does
        Assert.Equal(SagaState.Rejected, resumed.State);
        Assert.Equal(EnrollmentStatus.Rejected, (await Db.Enrollments.AsNoTracking().SingleAsync()).Status);
    }

    [Fact]
    public async Task Same_idempotency_key_returns_the_stored_saga_and_calls_nothing_again()
    {
        var first = await Saga().StartAsync("same", 1, 5, null);
        var again = await Saga().StartAsync("same", 1, 5, null);
        Assert.Equal(first.SagaId, again.SagaId); Assert.Equal(1, await Db.Sagas.CountAsync());
        Students.Verify(s => s.EligibilityAsync(1, default), Times.Once);
        Courses.Verify(c => c.ReserveSeatAsync(5, It.IsAny<long>(), default), Times.Once);
    }

    [Fact]
    public async Task Saga_resumes_from_its_persisted_state_without_repeating_earlier_steps()
    {
        // simulate a crash after the PENDING enrollment was created: state PendingCreated, seat not reserved yet
        var enr = new EnrollmentService.Entities.Enrollment { StudentId = 1, CourseId = 5, StudentName = "Asha Rao", StudentEmail = "a@b.c", CourseName = "Java", Status = EnrollmentStatus.Pending, IdempotencyKey = "crash" };
        Db.Enrollments.Add(enr); await Db.SaveChangesAsync();
        var saga = new SagaInstance { IdempotencyKey = "crash", StudentId = 1, CourseId = 5, EnrollmentId = enr.EnrollmentId, State = SagaState.PendingCreated };
        Db.Sagas.Add(saga); await Db.SaveChangesAsync();

        var done = await Saga().RunAsync(saga.SagaId);
        Assert.Equal(SagaState.Completed, done.State);
        Students.Verify(s => s.EligibilityAsync(It.IsAny<long>(), default), Times.Never);   // validation steps were NOT repeated
        Courses.Verify(c => c.ReserveSeatAsync(5, enr.EnrollmentId, default), Times.Once);
        Assert.Equal(EnrollmentStatus.Confirmed, (await Db.Enrollments.AsNoTracking().SingleAsync()).Status);
    }
}

public class EnrollmentStateMachineTests
{
    [Theory]
    [InlineData(EnrollmentStatus.Pending, EnrollmentStatus.Confirmed, true)]
    [InlineData(EnrollmentStatus.Pending, EnrollmentStatus.Rejected, true)]
    [InlineData(EnrollmentStatus.Confirmed, EnrollmentStatus.Cancelled, true)]
    [InlineData(EnrollmentStatus.Pending, EnrollmentStatus.Cancelled, false)]
    [InlineData(EnrollmentStatus.Rejected, EnrollmentStatus.Confirmed, false)]
    [InlineData(EnrollmentStatus.Cancelled, EnrollmentStatus.Confirmed, false)]
    [InlineData(EnrollmentStatus.Confirmed, EnrollmentStatus.Pending, false)]
    public void Only_legal_transitions_are_allowed(EnrollmentStatus from, EnrollmentStatus to, bool legal)
    {
        var e = new EnrollmentService.Entities.Enrollment { Status = from };
        if (legal) { e.TransitionTo(to); Assert.Equal(to, e.Status); }
        else Assert.Throws<BusinessRuleException>(() => e.TransitionTo(to));
    }
}

/// <summary>CQRS command handlers.</summary>
public class EnrollmentCommandHandlerTests : SagaFixture
{
    private CreateEnrollmentCommandHandler Create() => new(Saga(), Db);
    private CancelEnrollmentCommandHandler Cancel() => new(Db, Courses.Object, Events.Object, NullLogger<CancelEnrollmentCommandHandler>.Instance);

    [Fact]
    public async Task Create_maps_saga_outcomes_to_confirmed_rejected_and_in_progress()
    {
        foreach (var id in new long[] { 2, 3 })   // three different students so the duplicate-enrollment rule does not interfere
        {
            Students.Setup(x => x.EligibilityAsync(id, default)).ReturnsAsync(new EligibilityInfo(id, true, null));
            Students.Setup(x => x.GetAsync(id, default)).ReturnsAsync(new StudentInfo(id, "S", "" + id, $"s{id}@x.com", "Active"));
        }
        Assert.Equal(EnrollmentOutcome.Confirmed, (await Create().HandleAsync(new CreateEnrollmentCommand(1, 5, "c1", null))).Result);

        Students.Setup(x => x.EligibilityAsync(2, default)).ReturnsAsync(new EligibilityInfo(2, false, "Inactive"));
        var rej = await Create().HandleAsync(new CreateEnrollmentCommand(2, 5, "c2", null));
        Assert.Equal(EnrollmentOutcome.Rejected, rej.Result); Assert.Contains("not eligible", rej.Message);

        Courses.Setup(c => c.ReserveSeatAsync(5, It.IsAny<long>(), default)).ThrowsAsync(new RemoteConflictException("409"));
        Courses.Setup(c => c.ReleaseSeatAsync(5, It.IsAny<long>(), default)).ThrowsAsync(new ServiceUnavailableException("down"));
        var prog = await Create().HandleAsync(new CreateEnrollmentCommand(3, 5, "c3", null));
        Assert.Equal(EnrollmentOutcome.InProgress, prog.Result);   // compensation paused: the saga is persisted, not lost
    }

    [Fact]
    public async Task Create_blocks_a_second_active_enrollment_but_lets_the_same_key_replay()
    {
        await Create().HandleAsync(new CreateEnrollmentCommand(1, 5, "dup-1", null));
        await Assert.ThrowsAsync<ConflictException>(() => Create().HandleAsync(new CreateEnrollmentCommand(1, 5, "dup-2", null)));
        var replay = await Create().HandleAsync(new CreateEnrollmentCommand(1, 5, "dup-1", null));   // same key: no conflict, same result
        Assert.Equal(EnrollmentOutcome.Confirmed, replay.Result);
        Assert.Equal(1, await Db.Enrollments.CountAsync());
    }

    [Fact]
    public async Task Create_allows_a_new_enrollment_after_the_previous_one_was_cancelled()
    {
        var first = await Create().HandleAsync(new CreateEnrollmentCommand(1, 5, "again-1", null));
        await Cancel().HandleAsync(new CancelEnrollmentCommand(first.Enrollment!.EnrollmentId, "changed mind"));
        var second = await Create().HandleAsync(new CreateEnrollmentCommand(1, 5, "again-2", null));
        Assert.Equal(EnrollmentOutcome.Confirmed, second.Result);
    }

    [Fact]
    public async Task Cancel_releases_the_seat_then_cancels_and_records_the_event()
    {
        var created = await Create().HandleAsync(new CreateEnrollmentCommand(1, 5, "cx", null));
        Recorded.Clear();
        var r = await Cancel().HandleAsync(new CancelEnrollmentCommand(created.Enrollment!.EnrollmentId, "no longer needed"));
        Assert.Equal(EnrollmentStatus.Cancelled, r.EnrollmentStatus); Assert.Equal("no longer needed", r.Remarks);
        Courses.Verify(c => c.ReleaseSeatAsync(5, created.Enrollment.EnrollmentId, default), Times.AtLeastOnce);
        Assert.Equal(new[] { EventTypes.EnrollmentCancelled }, Recorded);
    }

    [Fact]
    public async Task Cancel_when_course_service_is_down_changes_nothing_so_the_caller_can_retry()
    {
        var created = await Create().HandleAsync(new CreateEnrollmentCommand(1, 5, "cy", null));
        Courses.Setup(c => c.ReleaseSeatAsync(5, It.IsAny<long>(), default)).ThrowsAsync(new ServiceUnavailableException("down"));
        await Assert.ThrowsAsync<ServiceUnavailableException>(() => Cancel().HandleAsync(new CancelEnrollmentCommand(created.Enrollment!.EnrollmentId, null)));
        Assert.Equal(EnrollmentStatus.Confirmed, (await Db.Enrollments.AsNoTracking().SingleAsync()).Status);
    }

    [Fact]
    public async Task Cancel_rules_unknown_pending_and_already_cancelled()
    {
        await Assert.ThrowsAsync<NotFoundException>(() => Cancel().HandleAsync(new CancelEnrollmentCommand(999, null)));
        var pending = new EnrollmentService.Entities.Enrollment { StudentId = 1, CourseId = 5, Status = EnrollmentStatus.Pending, IdempotencyKey = "p" };
        var cancelled = new EnrollmentService.Entities.Enrollment { StudentId = 2, CourseId = 5, Status = EnrollmentStatus.Cancelled, IdempotencyKey = "c" };
        Db.Enrollments.AddRange(pending, cancelled); await Db.SaveChangesAsync();
        await Assert.ThrowsAsync<ConflictException>(() => Cancel().HandleAsync(new CancelEnrollmentCommand(pending.EnrollmentId, null)));
        await Assert.ThrowsAsync<BusinessRuleException>(() => Cancel().HandleAsync(new CancelEnrollmentCommand(cancelled.EnrollmentId, null)));
    }

    [Fact]
    public async Task Update_changes_only_the_remarks_never_the_status()
    {
        var e = new EnrollmentService.Entities.Enrollment { StudentId = 1, CourseId = 5, Status = EnrollmentStatus.Confirmed, IdempotencyKey = "u" };
        Db.Enrollments.Add(e); await Db.SaveChangesAsync();
        var r = await new UpdateEnrollmentCommandHandler(Db).HandleAsync(new UpdateEnrollmentCommand(e.EnrollmentId, "note"));
        Assert.Equal("note", r.Remarks); Assert.Equal(EnrollmentStatus.Confirmed, r.EnrollmentStatus);
        await Assert.ThrowsAsync<NotFoundException>(() => new UpdateEnrollmentCommandHandler(Db).HandleAsync(new UpdateEnrollmentCommand(999, "x")));
    }
}

/// <summary>CQRS query handlers: filtering, paging, sorting; read side never calls other services.</summary>
public class EnrollmentQueryTests : SagaFixture
{
    private async Task Seed()
    {
        for (var i = 1; i <= 7; i++)
            Db.Enrollments.Add(new EnrollmentService.Entities.Enrollment { StudentId = i % 2 == 0 ? 2 : 1, CourseId = i <= 4 ? 5 : 6, Status = i % 3 == 0 ? EnrollmentStatus.Rejected : EnrollmentStatus.Confirmed, IdempotencyKey = "q" + i });
        await Db.SaveChangesAsync();
    }
    private static PageRequest P(int page = 0, int size = 10, string? sort = null) => PageRequest.Create(page, size, sort, "EnrollmentId,desc", EnrollmentQueryHandlers.Sortable);

    [Fact]
    public async Task Search_filters_by_student_course_and_status_with_paging_and_default_newest_first()
    {
        await Seed(); var q = new EnrollmentQueryHandlers(Db);
        var all = await q.HandleAsync(new SearchEnrollmentsQuery(null, null, null, null, null, P(0, 3)));
        Assert.Equal(7, all.TotalElements); Assert.Equal(3, all.TotalPages); Assert.Equal(3, all.Content.Count);
        Assert.True(all.Content[0].EnrollmentId > all.Content[1].EnrollmentId);
        Assert.Equal(2, (await q.HandleAsync(new SearchEnrollmentsQuery(null, null, EnrollmentStatus.Rejected, null, null, P()))).TotalElements);
        Assert.All((await q.HandleAsync(new StudentEnrollmentHistoryQuery(2, P()))).Content, e => Assert.Equal(2, e.StudentId));
        Assert.Equal(3, (await q.HandleAsync(new CourseEnrollmentsQuery(6, null, P()))).TotalElements);
    }

    [Fact]
    public async Task Get_unknown_enrollment_is_not_found_and_sort_columns_are_whitelisted()
    {
        await Assert.ThrowsAsync<NotFoundException>(() => new EnrollmentQueryHandlers(Db).HandleAsync(new GetEnrollmentQuery(404)));
        Assert.Throws<ArgumentException>(() => P(0, 10, "idempotencyKey,asc"));
    }
}
