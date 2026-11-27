using AutoMapper;
using FluentAssertions;
using Moq;
using StudentMgmt.BuildingBlocks.Common.Exceptions;
using StudentMgmt.BuildingBlocks.Contracts.Events;
using StudentMgmt.BuildingBlocks.Messaging;
using StudentMgmt.EnrollmentService.DTOs.Requests;
using StudentMgmt.EnrollmentService.Entities;
using StudentMgmt.EnrollmentService.Kafka.Producers;
using StudentMgmt.EnrollmentService.Mappings;
using StudentMgmt.EnrollmentService.Repositories.Interfaces;
using StudentMgmt.EnrollmentService.Services;
using StudentMgmt.EnrollmentService.UnitOfWork;
using Xunit;

namespace EnrollmentService.Tests;

public class EnrollmentAppServiceTests
{
    private readonly Mock<IEnrollmentUnitOfWork> _unitOfWorkMock = new();
    private readonly Mock<IEnrollmentRepository> _enrollmentRepositoryMock = new();
    private readonly Mock<IStudentSnapshotRepository> _studentSnapshotRepositoryMock = new();
    private readonly Mock<ICourseSnapshotRepository> _courseSnapshotRepositoryMock = new();
    private readonly Mock<IEventProducer> _eventProducerMock = new();
    private readonly IMapper _mapper;

    public EnrollmentAppServiceTests()
    {
        _unitOfWorkMock.SetupGet(u => u.Enrollments).Returns(_enrollmentRepositoryMock.Object);
        _unitOfWorkMock.SetupGet(u => u.StudentSnapshots).Returns(_studentSnapshotRepositoryMock.Object);
        _unitOfWorkMock.SetupGet(u => u.CourseSnapshots).Returns(_courseSnapshotRepositoryMock.Object);
        _unitOfWorkMock.Setup(u => u.CommitAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var mapperConfig = new MapperConfiguration(cfg => cfg.AddProfile<EnrollmentProfile>());
        _mapper = mapperConfig.CreateMapper();
    }

    private EnrollmentAppService CreateSut() =>
        new(_unitOfWorkMock.Object, _mapper, new EnrollmentEventPublisher(_eventProducerMock.Object));

    private static StudentSnapshot MakeStudent(Guid id) => new() { Id = id, FullName = "Ada Lovelace", Email = "ada@example.com" };

    private static CourseSnapshot MakeCourse(Guid id, int capacity, int enrolledCount) =>
        new() { Id = id, Title = "Intro to Algorithms", Capacity = capacity, EnrolledCount = enrolledCount };

    [Fact]
    public async Task EnrollAsync_WithRoomAvailable_CreatesEnrollmentAndIncrementsEnrolledCount()
    {
        var studentId = Guid.NewGuid();
        var courseId = Guid.NewGuid();
        var student = MakeStudent(studentId);
        var course = MakeCourse(courseId, capacity: 30, enrolledCount: 5);

        _studentSnapshotRepositoryMock.Setup(r => r.GetByIdAsync(studentId, It.IsAny<CancellationToken>())).ReturnsAsync(student);
        _courseSnapshotRepositoryMock.Setup(r => r.GetByIdAsync(courseId, It.IsAny<CancellationToken>())).ReturnsAsync(course);
        _enrollmentRepositoryMock.Setup(r => r.HasActiveEnrollmentAsync(studentId, courseId, It.IsAny<CancellationToken>())).ReturnsAsync(false);

        var sut = CreateSut();

        var result = await sut.EnrollAsync(new EnrollStudentRequest { StudentId = studentId, CourseId = courseId });

        result.Status.Should().Be(EnrollmentStatus.Confirmed);
        result.StudentFullName.Should().Be("Ada Lovelace");
        result.CourseTitle.Should().Be("Intro to Algorithms");
        course.EnrolledCount.Should().Be(6);

        _enrollmentRepositoryMock.Verify(r => r.AddAsync(It.Is<Enrollment>(e =>
            e.StudentId == studentId && e.CourseId == courseId && e.Status == EnrollmentStatus.Confirmed), It.IsAny<CancellationToken>()), Times.Once);
        _courseSnapshotRepositoryMock.Verify(r => r.Update(course), Times.Once);
        _unitOfWorkMock.Verify(u => u.CommitAsync(It.IsAny<CancellationToken>()), Times.Once);
        _eventProducerMock.Verify(p => p.PublishAsync(
            StudentMgmt.BuildingBlocks.Contracts.KafkaTopics.EnrollmentCreated,
            It.Is<EnrollmentCreatedEvent>(e => e.StudentId == studentId && e.CourseId == courseId),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task EnrollAsync_WhenCourseIsFull_ThrowsBusinessRuleException()
    {
        var studentId = Guid.NewGuid();
        var courseId = Guid.NewGuid();
        var student = MakeStudent(studentId);
        var course = MakeCourse(courseId, capacity: 10, enrolledCount: 10);

        _studentSnapshotRepositoryMock.Setup(r => r.GetByIdAsync(studentId, It.IsAny<CancellationToken>())).ReturnsAsync(student);
        _courseSnapshotRepositoryMock.Setup(r => r.GetByIdAsync(courseId, It.IsAny<CancellationToken>())).ReturnsAsync(course);

        var sut = CreateSut();

        var act = () => sut.EnrollAsync(new EnrollStudentRequest { StudentId = studentId, CourseId = courseId });

        await act.Should().ThrowAsync<BusinessRuleException>().WithMessage("Course is at full capacity.");
        _enrollmentRepositoryMock.Verify(r => r.AddAsync(It.IsAny<Enrollment>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task EnrollAsync_WhenAlreadyActivelyEnrolled_ThrowsBusinessRuleException()
    {
        var studentId = Guid.NewGuid();
        var courseId = Guid.NewGuid();
        var student = MakeStudent(studentId);
        var course = MakeCourse(courseId, capacity: 30, enrolledCount: 5);

        _studentSnapshotRepositoryMock.Setup(r => r.GetByIdAsync(studentId, It.IsAny<CancellationToken>())).ReturnsAsync(student);
        _courseSnapshotRepositoryMock.Setup(r => r.GetByIdAsync(courseId, It.IsAny<CancellationToken>())).ReturnsAsync(course);
        _enrollmentRepositoryMock.Setup(r => r.HasActiveEnrollmentAsync(studentId, courseId, It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var sut = CreateSut();

        var act = () => sut.EnrollAsync(new EnrollStudentRequest { StudentId = studentId, CourseId = courseId });

        await act.Should().ThrowAsync<BusinessRuleException>().WithMessage("Student is already enrolled in this course.");
        _enrollmentRepositoryMock.Verify(r => r.AddAsync(It.IsAny<Enrollment>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task EnrollAsync_WhenStudentSnapshotMissing_ThrowsNotFoundException()
    {
        var studentId = Guid.NewGuid();
        var courseId = Guid.NewGuid();

        _studentSnapshotRepositoryMock.Setup(r => r.GetByIdAsync(studentId, It.IsAny<CancellationToken>())).ReturnsAsync((StudentSnapshot?)null);

        var sut = CreateSut();

        var act = () => sut.EnrollAsync(new EnrollStudentRequest { StudentId = studentId, CourseId = courseId });

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task CancelAsync_DecrementsEnrolledCountAndPublishesCancelEvent()
    {
        var studentId = Guid.NewGuid();
        var courseId = Guid.NewGuid();
        var enrollmentId = Guid.NewGuid();
        var student = MakeStudent(studentId);
        var course = MakeCourse(courseId, capacity: 30, enrolledCount: 6);
        var enrollment = new Enrollment
        {
            Id = enrollmentId,
            StudentId = studentId,
            CourseId = courseId,
            Status = EnrollmentStatus.Confirmed,
            EnrolledOnUtc = DateTime.UtcNow
        };

        _enrollmentRepositoryMock.Setup(r => r.GetByIdAsync(enrollmentId, It.IsAny<CancellationToken>())).ReturnsAsync(enrollment);
        _studentSnapshotRepositoryMock.Setup(r => r.GetByIdAsync(studentId, It.IsAny<CancellationToken>())).ReturnsAsync(student);
        _courseSnapshotRepositoryMock.Setup(r => r.GetByIdAsync(courseId, It.IsAny<CancellationToken>())).ReturnsAsync(course);

        var sut = CreateSut();

        var result = await sut.CancelAsync(enrollmentId, new CancelEnrollmentRequest { Reason = "Schedule conflict" });

        result.Status.Should().Be(EnrollmentStatus.Cancelled);
        course.EnrolledCount.Should().Be(5);
        enrollment.CancellationReason.Should().Be("Schedule conflict");
        enrollment.CancelledOnUtc.Should().NotBeNull();

        _courseSnapshotRepositoryMock.Verify(r => r.Update(course), Times.Once);
        _eventProducerMock.Verify(p => p.PublishAsync(
            StudentMgmt.BuildingBlocks.Contracts.KafkaTopics.EnrollmentCancelled,
            It.Is<EnrollmentCancelledEvent>(e => e.EnrollmentId == enrollmentId && e.Reason == "Schedule conflict"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CancelAsync_WhenAlreadyCancelled_ThrowsNotFoundException()
    {
        var enrollmentId = Guid.NewGuid();
        var enrollment = new Enrollment { Id = enrollmentId, Status = EnrollmentStatus.Cancelled };

        _enrollmentRepositoryMock.Setup(r => r.GetByIdAsync(enrollmentId, It.IsAny<CancellationToken>())).ReturnsAsync(enrollment);

        var sut = CreateSut();

        var act = () => sut.CancelAsync(enrollmentId, new CancelEnrollmentRequest { Reason = "Whatever" });

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task CancelAsync_DoesNotDecrementBelowZero()
    {
        var studentId = Guid.NewGuid();
        var courseId = Guid.NewGuid();
        var enrollmentId = Guid.NewGuid();
        var student = MakeStudent(studentId);
        var course = MakeCourse(courseId, capacity: 30, enrolledCount: 0);
        var enrollment = new Enrollment
        {
            Id = enrollmentId,
            StudentId = studentId,
            CourseId = courseId,
            Status = EnrollmentStatus.Confirmed,
            EnrolledOnUtc = DateTime.UtcNow
        };

        _enrollmentRepositoryMock.Setup(r => r.GetByIdAsync(enrollmentId, It.IsAny<CancellationToken>())).ReturnsAsync(enrollment);
        _studentSnapshotRepositoryMock.Setup(r => r.GetByIdAsync(studentId, It.IsAny<CancellationToken>())).ReturnsAsync(student);
        _courseSnapshotRepositoryMock.Setup(r => r.GetByIdAsync(courseId, It.IsAny<CancellationToken>())).ReturnsAsync(course);

        var sut = CreateSut();

        await sut.CancelAsync(enrollmentId, new CancelEnrollmentRequest { Reason = "Test" });

        course.EnrolledCount.Should().Be(0);
    }
}
