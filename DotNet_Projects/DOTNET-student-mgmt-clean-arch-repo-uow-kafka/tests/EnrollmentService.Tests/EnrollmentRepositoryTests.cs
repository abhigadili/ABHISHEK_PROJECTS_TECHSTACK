using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using StudentMgmt.EnrollmentService.Entities;
using StudentMgmt.EnrollmentService.Persistence;
using StudentMgmt.EnrollmentService.Repositories;
using Xunit;

namespace EnrollmentService.Tests;

public class EnrollmentRepositoryTests
{
    private static EnrollmentDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<EnrollmentDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new EnrollmentDbContext(options);
    }

    [Fact]
    public async Task HasActiveEnrollmentAsync_IgnoresCancelledEnrollments()
    {
        await using var context = CreateContext();
        var studentId = Guid.NewGuid();
        var courseId = Guid.NewGuid();

        context.Enrollments.Add(new Enrollment
        {
            StudentId = studentId,
            CourseId = courseId,
            Status = EnrollmentStatus.Cancelled,
            EnrolledOnUtc = DateTime.UtcNow.AddDays(-10),
            CancelledOnUtc = DateTime.UtcNow.AddDays(-5),
            CancellationReason = "Changed mind"
        });
        await context.SaveChangesAsync();

        var repository = new EnrollmentRepository(context);

        var hasActive = await repository.HasActiveEnrollmentAsync(studentId, courseId);

        hasActive.Should().BeFalse();
    }

    [Fact]
    public async Task HasActiveEnrollmentAsync_ReturnsTrue_WhenConfirmedEnrollmentExists()
    {
        await using var context = CreateContext();
        var studentId = Guid.NewGuid();
        var courseId = Guid.NewGuid();

        context.Enrollments.Add(new Enrollment
        {
            StudentId = studentId,
            CourseId = courseId,
            Status = EnrollmentStatus.Confirmed,
            EnrolledOnUtc = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var repository = new EnrollmentRepository(context);

        var hasActive = await repository.HasActiveEnrollmentAsync(studentId, courseId);

        hasActive.Should().BeTrue();
    }

    [Fact]
    public async Task HasActiveEnrollmentAsync_WithCancelledThenNewActiveEnrollment_ReturnsTrue()
    {
        await using var context = CreateContext();
        var studentId = Guid.NewGuid();
        var courseId = Guid.NewGuid();

        context.Enrollments.Add(new Enrollment
        {
            StudentId = studentId,
            CourseId = courseId,
            Status = EnrollmentStatus.Cancelled,
            EnrolledOnUtc = DateTime.UtcNow.AddDays(-10),
            CancelledOnUtc = DateTime.UtcNow.AddDays(-5)
        });
        context.Enrollments.Add(new Enrollment
        {
            StudentId = studentId,
            CourseId = courseId,
            Status = EnrollmentStatus.Confirmed,
            EnrolledOnUtc = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var repository = new EnrollmentRepository(context);

        var hasActive = await repository.HasActiveEnrollmentAsync(studentId, courseId);

        hasActive.Should().BeTrue();
    }

    [Fact]
    public async Task GetByStudentIdAsync_ReturnsAllEnrollmentsForStudentRegardlessOfStatus()
    {
        await using var context = CreateContext();
        var studentId = Guid.NewGuid();

        context.Enrollments.Add(new Enrollment { StudentId = studentId, CourseId = Guid.NewGuid(), Status = EnrollmentStatus.Confirmed, EnrolledOnUtc = DateTime.UtcNow });
        context.Enrollments.Add(new Enrollment { StudentId = studentId, CourseId = Guid.NewGuid(), Status = EnrollmentStatus.Cancelled, EnrolledOnUtc = DateTime.UtcNow.AddDays(-1) });
        context.Enrollments.Add(new Enrollment { StudentId = Guid.NewGuid(), CourseId = Guid.NewGuid(), Status = EnrollmentStatus.Confirmed, EnrolledOnUtc = DateTime.UtcNow });
        await context.SaveChangesAsync();

        var repository = new EnrollmentRepository(context);

        var history = await repository.GetByStudentIdAsync(studentId);

        history.Should().HaveCount(2);
        history.Should().OnlyContain(e => e.StudentId == studentId);
    }
}
