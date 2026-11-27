using Common.Caching;
using Common.Errors;
using CourseService.Data;
using CourseService.Dtos;
using CourseService.Entities;
using CourseService.Repositories;
using CourseService.Services;
using EventContracts;
using Messaging;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace UnitTests.CourseTests;

public class CourseAppServiceTests
{
    private readonly Mock<ICourseRepository> _repo = new();
    private readonly Mock<ICategoryRepository> _cats = new();
    private readonly Mock<ICacheService> _cache = new();
    private CourseAppService Svc() => new(_repo.Object, _cats.Object, _cache.Object, NullLogger<CourseAppService>.Instance);
    private static CourseRequest Req(int seats = 10, long? cat = null) => new("Java", "JV-101", null, cat, 6, 100m, seats, null);

    [Fact]
    public async Task Create_starts_with_all_seats_free()
    {
        CourseService.Entities.Course? added = null;
        _repo.Setup(r => r.AddAsync(It.IsAny<CourseService.Entities.Course>(), default)).Callback<CourseService.Entities.Course, CancellationToken>((c, _) => added = c).Returns(Task.CompletedTask);
        _repo.Setup(r => r.FindReadOnlyAsync(It.IsAny<long>(), default)).ReturnsAsync(() => added);
        var resp = await Svc().CreateAsync(Req(30));
        Assert.Equal(30, added!.TotalSeats); Assert.Equal(30, added.AvailableSeats);
        Assert.Equal(30, resp.AvailableSeats);
    }

    [Fact]
    public async Task Create_rejects_duplicate_code_and_unknown_category()
    {
        _repo.Setup(r => r.CodeExistsAsync("JV-101", null, default)).ReturnsAsync(true);
        await Assert.ThrowsAsync<ConflictException>(() => Svc().CreateAsync(Req()));
        _repo.Setup(r => r.CodeExistsAsync("JV-101", null, default)).ReturnsAsync(false);
        _cats.Setup(c => c.FindAsync(5, default)).ReturnsAsync((CourseCategory?)null);
        await Assert.ThrowsAsync<BusinessRuleException>(() => Svc().CreateAsync(Req(10, 5)));
    }

    [Fact]
    public async Task Capacity_below_reserved_seats_is_a_business_rule_violation()
    {
        var c = new CourseService.Entities.Course { CourseId = 1, TotalSeats = 10, AvailableSeats = 2 };
        _repo.Setup(r => r.FindAsync(1, default)).ReturnsAsync(c);
        _repo.Setup(r => r.ChangeCapacityAsync(1, 5, default)).ReturnsAsync(0);   // atomic UPDATE matched no row
        await Assert.ThrowsAsync<BusinessRuleException>(() => Svc().UpdateAsync(1, Req(5)));
        _cache.Verify(x => x.RemoveAsync(It.IsAny<string>(), default), Times.Never);
    }

    [Fact]
    public async Task Update_evicts_both_caches_and_bumps_the_concurrency_token()
    {
        var c = new CourseService.Entities.Course { CourseId = 1, TotalSeats = 10, AvailableSeats = 10, Version = 4 };
        _repo.Setup(r => r.FindAsync(1, default)).ReturnsAsync(c);
        _repo.Setup(r => r.FindReadOnlyAsync(1, default)).ReturnsAsync(c);
        await Svc().UpdateAsync(1, Req(10));
        Assert.Equal(5, c.Version);
        _cache.Verify(x => x.RemoveAsync("course:1", default), Times.Once);
        _cache.Verify(x => x.RemoveAsync("course-availability:1", default), Times.Once);
        _repo.Verify(r => r.ChangeCapacityAsync(It.IsAny<long>(), It.IsAny<int>(), default), Times.Never);   // capacity unchanged → no seat UPDATE
    }

    [Fact]
    public void Availability_is_false_for_inactive_or_sold_out_courses()
    {
        Assert.True(CourseAppService.ToAvailability(new CourseService.Entities.Course { AvailableSeats = 1, Status = CourseStatus.Active }).Available);
        Assert.False(CourseAppService.ToAvailability(new CourseService.Entities.Course { AvailableSeats = 0, Status = CourseStatus.Active }).Available);
        Assert.False(CourseAppService.ToAvailability(new CourseService.Entities.Course { AvailableSeats = 5, Status = CourseStatus.Inactive }).Available);
    }
}

public class SeatServiceTests
{
    private readonly Mock<ICourseRepository> _repo = new();
    private readonly Mock<ICacheService> _cache = new();
    private readonly Mock<IEventPublisher> _pub = new();
    private readonly CourseDbContext _db = new(new DbContextOptionsBuilder<CourseDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString())
        .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)).Options);

    private SeatService Svc(int threshold = 5) => new(_db, _repo.Object, _cache.Object, _pub.Object,
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Course:LowAvailabilityThreshold"] = threshold.ToString() }).Build(), NullLogger<SeatService>.Instance);

    private static CourseService.Entities.Course C(int available, CourseStatus st = CourseStatus.Active) => new() { CourseId = 1, CourseCode = "JV-1", CourseName = "Java", TotalSeats = 30, AvailableSeats = available, Status = st };

    [Fact]
    public async Task Reserve_success_takes_one_seat_records_reservation_and_evicts_caches()
    {
        _repo.SetupSequence(r => r.FindReadOnlyAsync(1, default)).ReturnsAsync(C(20)).ReturnsAsync(C(19));
        _repo.Setup(r => r.FindReservationAsync(77, default)).ReturnsAsync((SeatReservation?)null);
        _repo.Setup(r => r.TryReserveSeatAsync(1, default)).ReturnsAsync(1);
        var res = await Svc().ReserveAsync(1, 77);
        Assert.False(res.Replayed); Assert.Equal(19, res.AvailableSeats);
        _repo.Verify(r => r.AddReservationAsync(It.Is<SeatReservation>(x => x.EnrollmentId == 77 && x.Status == ReservationStatus.Reserved), default), Times.Once);
        _cache.Verify(c => c.RemoveAsync("course-availability:1", default), Times.Once);
        _pub.Verify(p => p.Publish(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), null), Times.Never);   // 19 > threshold
    }

    [Fact]
    public async Task Reserve_publishes_low_availability_when_at_or_below_threshold()
    {
        _repo.SetupSequence(r => r.FindReadOnlyAsync(1, default)).ReturnsAsync(C(6)).ReturnsAsync(C(5));
        _repo.Setup(r => r.TryReserveSeatAsync(1, default)).ReturnsAsync(1);
        await Svc(5).ReserveAsync(1, 8);
        _pub.Verify(p => p.Publish("course.low-availability", It.IsAny<string>(), EventTypes.LowCourseAvailability, It.Is<string>(j => j.Contains("\"availableSeats\":5")), null), Times.Once);
    }

    [Fact]
    public async Task Reserve_with_no_seats_conflicts_and_stores_nothing()
    {
        _repo.Setup(r => r.FindReadOnlyAsync(1, default)).ReturnsAsync(C(0));
        _repo.Setup(r => r.TryReserveSeatAsync(1, default)).ReturnsAsync(0);
        var ex = await Assert.ThrowsAsync<ConflictException>(() => Svc().ReserveAsync(1, 9));
        Assert.Contains("No seats", ex.Message);
        _repo.Verify(r => r.AddReservationAsync(It.IsAny<SeatReservation>(), default), Times.Never);
    }

    [Fact]
    public async Task Reserve_for_inactive_course_says_not_active()
    {
        _repo.Setup(r => r.FindReadOnlyAsync(1, default)).ReturnsAsync(C(3, CourseStatus.Inactive));
        _repo.Setup(r => r.TryReserveSeatAsync(1, default)).ReturnsAsync(0);
        var ex = await Assert.ThrowsAsync<ConflictException>(() => Svc().ReserveAsync(1, 9));
        Assert.Contains("not active", ex.Message);
    }

    [Fact]
    public async Task Reserve_is_idempotent_per_enrollment_id()
    {
        _repo.Setup(r => r.FindReadOnlyAsync(1, default)).ReturnsAsync(C(12));
        _repo.Setup(r => r.FindReservationAsync(77, default)).ReturnsAsync(new SeatReservation { EnrollmentId = 77, CourseId = 1, Status = ReservationStatus.Reserved });
        var res = await Svc().ReserveAsync(1, 77);
        Assert.True(res.Replayed);
        _repo.Verify(r => r.TryReserveSeatAsync(It.IsAny<long>(), default), Times.Never);   // the seat counter is not touched again
    }

    [Fact]
    public async Task Reserve_after_release_for_same_enrollment_is_a_conflict()
    {
        _repo.Setup(r => r.FindReadOnlyAsync(1, default)).ReturnsAsync(C(12));
        _repo.Setup(r => r.FindReservationAsync(77, default)).ReturnsAsync(new SeatReservation { EnrollmentId = 77, CourseId = 1, Status = ReservationStatus.Released });
        await Assert.ThrowsAsync<ConflictException>(() => Svc().ReserveAsync(1, 77));
    }

    [Fact]
    public async Task Release_of_unknown_or_already_released_reservation_is_a_successful_noop()
    {
        _repo.Setup(r => r.FindReadOnlyAsync(1, default)).ReturnsAsync(C(12));
        _repo.Setup(r => r.FindReservationAsync(5, default)).ReturnsAsync((SeatReservation?)null);
        var res = await Svc().ReleaseAsync(1, 5);
        Assert.True(res.Replayed);
        _repo.Verify(r => r.TryReleaseSeatAsync(It.IsAny<long>(), default), Times.Never);
    }

    [Fact]
    public async Task Release_returns_the_seat_and_marks_reservation_released()
    {
        var reservation = new SeatReservation { EnrollmentId = 77, CourseId = 1, Status = ReservationStatus.Reserved };
        _repo.SetupSequence(r => r.FindReadOnlyAsync(1, default)).ReturnsAsync(C(10)).ReturnsAsync(C(11));
        _repo.Setup(r => r.FindReservationAsync(77, default)).ReturnsAsync(reservation);
        var res = await Svc().ReleaseAsync(1, 77);
        Assert.False(res.Replayed); Assert.Equal(11, res.AvailableSeats);
        Assert.Equal(ReservationStatus.Released, reservation.Status);
        _repo.Verify(r => r.TryReleaseSeatAsync(1, default), Times.Once);
        _cache.Verify(c => c.RemoveAsync("course:1", default), Times.Once);
    }
}
