using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using StudentMgmt.EnrollmentService.Persistence;
using StudentMgmt.EnrollmentService.Repositories;
using StudentMgmt.EnrollmentService.Services;
using StudentMgmt.EnrollmentService.UnitOfWork;
using Xunit;

namespace EnrollmentService.Tests;

public class SnapshotSyncServiceTests
{
    private static EnrollmentDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<EnrollmentDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new EnrollmentDbContext(options);
    }

    [Fact]
    public async Task UpsertStudentSnapshotAsync_OnStudentCreatedEvent_PersistsSnapshotWithIdEqualToStudentId()
    {
        await using var context = CreateContext();
        var unitOfWork = new EnrollmentUnitOfWork(context);
        var sut = new SnapshotSyncService(unitOfWork);

        var studentId = Guid.NewGuid();

        await sut.UpsertStudentSnapshotAsync(studentId, "Grace Hopper", "grace@example.com");

        var snapshot = await context.StudentSnapshots.SingleOrDefaultAsync(s => s.Id == studentId);
        snapshot.Should().NotBeNull();
        snapshot!.Id.Should().Be(studentId);
        snapshot.FullName.Should().Be("Grace Hopper");
        snapshot.Email.Should().Be("grace@example.com");
    }

    [Fact]
    public async Task UpsertStudentSnapshotAsync_CalledTwiceForSameStudent_UpdatesInsteadOfDuplicating()
    {
        await using var context = CreateContext();
        var unitOfWork = new EnrollmentUnitOfWork(context);
        var sut = new SnapshotSyncService(unitOfWork);

        var studentId = Guid.NewGuid();

        await sut.UpsertStudentSnapshotAsync(studentId, "Grace Hopper", "grace@old.com");
        await sut.UpsertStudentSnapshotAsync(studentId, "Grace M. Hopper", "grace@new.com");

        var all = await context.StudentSnapshots.Where(s => s.Id == studentId).ToListAsync();
        all.Should().HaveCount(1);
        all[0].FullName.Should().Be("Grace M. Hopper");
        all[0].Email.Should().Be("grace@new.com");
    }

    [Fact]
    public async Task RemoveStudentSnapshotAsync_SoftDeletesSnapshot()
    {
        await using var context = CreateContext();
        var unitOfWork = new EnrollmentUnitOfWork(context);
        var sut = new SnapshotSyncService(unitOfWork);

        var studentId = Guid.NewGuid();
        await sut.UpsertStudentSnapshotAsync(studentId, "Grace Hopper", "grace@example.com");

        await sut.RemoveStudentSnapshotAsync(studentId);

        var snapshot = await context.StudentSnapshots.IgnoreQueryFilters().SingleAsync(s => s.Id == studentId);
        snapshot.IsDeleted.Should().BeTrue();

        var repo = new StudentSnapshotRepository(context);
        (await repo.GetByIdAsync(studentId)).Should().BeNull();
    }

    [Fact]
    public async Task UpsertCourseSnapshotAsync_OnCourseCreatedEvent_PersistsSnapshotWithIdEqualToCourseId()
    {
        await using var context = CreateContext();
        var unitOfWork = new EnrollmentUnitOfWork(context);
        var sut = new SnapshotSyncService(unitOfWork);

        var courseId = Guid.NewGuid();

        await sut.UpsertCourseSnapshotAsync(courseId, "Operating Systems", 40);

        var snapshot = await context.CourseSnapshots.SingleOrDefaultAsync(c => c.Id == courseId);
        snapshot.Should().NotBeNull();
        snapshot!.Id.Should().Be(courseId);
        snapshot.Title.Should().Be("Operating Systems");
        snapshot.Capacity.Should().Be(40);
        snapshot.EnrolledCount.Should().Be(0);
    }

    [Fact]
    public async Task UpsertCourseSnapshotAsync_OnCourseUpdatedEvent_NeverOverwritesEnrolledCount()
    {
        await using var context = CreateContext();
        var unitOfWork = new EnrollmentUnitOfWork(context);
        var sut = new SnapshotSyncService(unitOfWork);

        var courseId = Guid.NewGuid();
        await sut.UpsertCourseSnapshotAsync(courseId, "Operating Systems", 40);

        var snapshot = await context.CourseSnapshots.SingleAsync(c => c.Id == courseId);
        snapshot.EnrolledCount = 12;
        await context.SaveChangesAsync();

        await sut.UpsertCourseSnapshotAsync(courseId, "Operating Systems II", 50);

        var updated = await context.CourseSnapshots.SingleAsync(c => c.Id == courseId);
        updated.Title.Should().Be("Operating Systems II");
        updated.Capacity.Should().Be(50);
        updated.EnrolledCount.Should().Be(12);
    }
}
