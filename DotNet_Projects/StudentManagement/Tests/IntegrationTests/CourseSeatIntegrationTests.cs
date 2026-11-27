using CourseService.Data;
using CourseService.Entities;
using CourseService.Repositories;
using CourseService.Services;
using Common.Caching;
using Common.Errors;
using EventContracts;
using Messaging;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace IntegrationTests;

/// <summary>MySQL integration: atomic seat reservation, idempotency, CHECK constraint and capacity change against a REAL MySQL 8.</summary>
[Collection("infra")]
public class CourseSeatIntegrationTests(InfraFixture infra) : IAsyncLifetime
{
    private string _cs = "";
    private DbContextOptions<CourseDbContext> Opts => new DbContextOptionsBuilder<CourseDbContext>().UseMySql(_cs, new MySqlServerVersion(new Version(8, 0, 36)), o => o.EnableRetryOnFailure(3)).Options;

    public async Task InitializeAsync() { _cs = await infra.NewDatabaseAsync("course"); await using var db = new CourseDbContext(Opts); await db.Database.MigrateAsync(); }
    public Task DisposeAsync() => Task.CompletedTask;

    private SeatService NewSeatService(CourseDbContext db, IEventPublisher? pub = null)
    {
        var cache = new Mock<ICacheService>();
        return new SeatService(db, new CourseRepository(db), cache.Object, pub ?? Mock.Of<IEventPublisher>(),
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Course:LowAvailabilityThreshold"] = "2" }).Build(), NullLogger<SeatService>.Instance);
    }

    private async Task<long> NewCourse(int seats)
    {
        await using var db = new CourseDbContext(Opts);
        var c = new Course { CourseName = "Java", CourseCode = "JV-" + Guid.NewGuid().ToString("N")[..6].ToUpper(), DurationWeeks = 4, Fees = 10, TotalSeats = seats, AvailableSeats = seats };
        db.Courses.Add(c); await db.SaveChangesAsync(); return c.CourseId;
    }

    [Fact]
    public async Task Thirty_concurrent_reservations_for_five_seats_succeed_exactly_five_times()
    {
        var courseId = await NewCourse(5);
        var results = await Task.WhenAll(Enumerable.Range(1, 30).Select(async i =>
        {
            await using var db = new CourseDbContext(Opts);                  // each request has its own DbContext/connection
            try { await NewSeatService(db).ReserveAsync(courseId, 1000 + i); return true; }
            catch (ConflictException) { return false; }
        }));
        Assert.Equal(5, results.Count(r => r));
        await using var check = new CourseDbContext(Opts);
        var c = await check.Courses.AsNoTracking().SingleAsync(x => x.CourseId == courseId);
        Assert.Equal(0, c.AvailableSeats);                                    // never negative, never oversold
        Assert.Equal(5, await check.Reservations.CountAsync(r => r.CourseId == courseId && r.Status == ReservationStatus.Reserved));
    }

    [Fact]
    public async Task Concurrent_duplicate_reservations_of_the_same_enrollment_consume_exactly_one_seat()
    {
        var courseId = await NewCourse(10);
        var outcomes = await Task.WhenAll(Enumerable.Range(0, 8).Select(async _ =>
        {
            await using var db = new CourseDbContext(Opts);
            try { return (await NewSeatService(db).ReserveAsync(courseId, 4242)).Replayed ? "replay" : "reserved"; }
            catch (Exception e) when (e is ConflictException or DbUpdateException) { return "conflict"; }   // lost the unique-index race: its transaction (incl. the seat decrement) rolled back
        }));
        Assert.Contains("reserved", outcomes);
        await using var check = new CourseDbContext(Opts);
        Assert.Equal(9, (await check.Courses.AsNoTracking().SingleAsync(x => x.CourseId == courseId)).AvailableSeats);
        Assert.Equal(1, await check.Reservations.CountAsync(r => r.EnrollmentId == 4242));
    }

    [Fact]
    public async Task Release_is_idempotent_and_never_exceeds_capacity()
    {
        var courseId = await NewCourse(3);
        await using var db = new CourseDbContext(Opts);
        await NewSeatService(db).ReserveAsync(courseId, 1);
        await using var db2 = new CourseDbContext(Opts);
        var r1 = await NewSeatService(db2).ReleaseAsync(courseId, 1);
        await using var db3 = new CourseDbContext(Opts);
        var r2 = await NewSeatService(db3).ReleaseAsync(courseId, 1);
        Assert.False(r1.Replayed); Assert.True(r2.Replayed);
        await using var check = new CourseDbContext(Opts);
        Assert.Equal(3, (await check.Courses.AsNoTracking().SingleAsync(x => x.CourseId == courseId)).AvailableSeats);
    }

    [Fact]
    public async Task Database_check_constraint_is_the_last_line_of_defence_against_negative_seats()
    {
        var courseId = await NewCourse(2);
        await using var db = new CourseDbContext(Opts);
        var ex = await Assert.ThrowsAnyAsync<Exception>(() => db.Database.ExecuteSqlRawAsync($"UPDATE dn_courses SET AvailableSeats = -1 WHERE CourseId = {courseId}"));
        Assert.Contains("chk_dn_courses_seats", ex.ToString());
        ex = await Assert.ThrowsAnyAsync<Exception>(() => db.Database.ExecuteSqlRawAsync($"UPDATE dn_courses SET AvailableSeats = 9 WHERE CourseId = {courseId}"));   // above capacity
        Assert.Contains("chk_dn_courses_seats", ex.ToString());
    }

    [Fact]
    public async Task Capacity_change_keeps_reserved_seats_and_refuses_to_go_below_them()
    {
        var courseId = await NewCourse(10);
        for (var i = 1; i <= 4; i++) { await using var d = new CourseDbContext(Opts); await NewSeatService(d).ReserveAsync(courseId, 500 + i); }
        await using var db = new CourseDbContext(Opts);
        var repo = new CourseRepository(db);
        Assert.Equal(1, await repo.ChangeCapacityAsync(courseId, 20));
        var c = await new CourseDbContext(Opts).Courses.AsNoTracking().SingleAsync(x => x.CourseId == courseId);
        Assert.Equal((20, 16), (c.TotalSeats, c.AvailableSeats));            // 4 taken stay taken (MySQL left-to-right SET semantics handled)
        Assert.Equal(0, await repo.ChangeCapacityAsync(courseId, 3));        // below the 4 reserved seats → refused
        Assert.Equal(1, await repo.ChangeCapacityAsync(courseId, 4));
        Assert.Equal(0, (await new CourseDbContext(Opts).Courses.AsNoTracking().SingleAsync(x => x.CourseId == courseId)).AvailableSeats);
    }

    [Fact]
    public async Task Inactive_course_cannot_be_reserved()
    {
        var courseId = await NewCourse(5);
        await using (var d = new CourseDbContext(Opts)) { var c = await d.Courses.SingleAsync(x => x.CourseId == courseId); c.Status = CourseStatus.Inactive; await d.SaveChangesAsync(); }
        await using var db = new CourseDbContext(Opts);
        var ex = await Assert.ThrowsAsync<ConflictException>(() => NewSeatService(db).ReserveAsync(courseId, 77));
        Assert.Contains("not active", ex.Message);
    }

    [Fact]
    public async Task Low_availability_event_is_published_after_commit_when_threshold_is_reached()
    {
        var courseId = await NewCourse(4);                                   // threshold 2
        var pub = new Mock<IEventPublisher>();
        for (var i = 1; i <= 3; i++) { await using var d = new CourseDbContext(Opts); await NewSeatService(d, pub.Object).ReserveAsync(courseId, 900 + i); }
        pub.Verify(p => p.Publish("course.low-availability", It.IsAny<string>(), EventTypes.LowCourseAvailability, It.IsAny<string>(), null), Times.Exactly(2));  // at 2 and 1 seats left
    }
}
