using AutoMapper;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StudentMgmt.BuildingBlocks.Common.Exceptions;
using StudentMgmt.BuildingBlocks.Contracts.Common;
using StudentMgmt.BuildingBlocks.Messaging;
using StudentMgmt.StudentService.DTOs.Requests;
using StudentMgmt.StudentService.Entities;
using StudentMgmt.StudentService.Kafka.Producers;
using StudentMgmt.StudentService.Mappings;
using StudentMgmt.StudentService.Repositories.Interfaces;
using StudentMgmt.StudentService.Services;
using StudentMgmt.StudentService.UnitOfWork;
using StudentMgmt.StudentService.Validators;
using Xunit;

namespace StudentMgmt.StudentService.Tests;

public class StudentAppServiceTests
{
    private readonly Mock<IStudentUnitOfWork> _unitOfWorkMock = new();
    private readonly Mock<IStudentRepository> _studentRepositoryMock = new();
    private readonly Mock<IEventProducer> _eventProducerMock = new();
    private readonly IMapper _mapper;

    public StudentAppServiceTests()
    {
        _unitOfWorkMock.Setup(u => u.Students).Returns(_studentRepositoryMock.Object);

        // IEventProducer.PublishAsync is generic (TEvent : IntegrationEvent) so it cannot be
        // Setup() directly for "any event type" without an explicit closed generic argument;
        // Moq's Loose mock behavior already returns Task.CompletedTask for unconfigured
        // Task-returning members, which is all StudentEventPublisher's fire-and-forget
        // publish calls need here.
        var mapperConfig = new MapperConfiguration(cfg => cfg.AddProfile<StudentProfile>());
        _mapper = mapperConfig.CreateMapper();
    }

    private StudentAppService CreateSut() =>
        new(
            _unitOfWorkMock.Object,
            _mapper,
            new CreateStudentRequestValidator(),
            new UpdateStudentRequestValidator(),
            new StudentEventPublisher(_eventProducerMock.Object),
            NullLogger<StudentAppService>.Instance);

    [Fact]
    public async Task CreateAsync_AddsStudentAndCommits_WhenEmailIsUnique()
    {
        _studentRepositoryMock.Setup(r => r.EmailExistsAsync("new@example.com", It.IsAny<CancellationToken>())).ReturnsAsync(false);

        var sut = CreateSut();
        var request = new CreateStudentRequest
        {
            FirstName = "Ada",
            LastName = "Lovelace",
            Email = "new@example.com",
            DateOfBirth = new DateTime(1995, 1, 1)
        };

        var result = await sut.CreateAsync(request);

        result.Email.Should().Be("new@example.com");
        result.EnrollmentNumber.Should().StartWith("STU-");
        _studentRepositoryMock.Verify(r => r.AddAsync(It.Is<Student>(s => s.Email == "new@example.com"), It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWorkMock.Verify(u => u.CommitAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CreateAsync_ThrowsBusinessRuleException_WhenEmailAlreadyExists()
    {
        _studentRepositoryMock.Setup(r => r.EmailExistsAsync("dup@example.com", It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var sut = CreateSut();
        var request = new CreateStudentRequest
        {
            FirstName = "Ada",
            LastName = "Lovelace",
            Email = "dup@example.com",
            DateOfBirth = new DateTime(1995, 1, 1)
        };

        var act = () => sut.CreateAsync(request);

        await act.Should().ThrowAsync<BusinessRuleException>();
        _studentRepositoryMock.Verify(r => r.AddAsync(It.IsAny<Student>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CreateAsync_ThrowsValidationAppException_WhenRequestIsInvalid()
    {
        var sut = CreateSut();
        var request = new CreateStudentRequest
        {
            FirstName = "",
            LastName = "",
            Email = "not-an-email",
            DateOfBirth = DateTime.UtcNow.AddDays(1)
        };

        var act = () => sut.CreateAsync(request);

        await act.Should().ThrowAsync<ValidationAppException>();
    }

    [Fact]
    public async Task UpdateAsync_ThrowsNotFoundException_WhenStudentDoesNotExist()
    {
        _studentRepositoryMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>())).ReturnsAsync((Student?)null);

        var sut = CreateSut();
        var request = new UpdateStudentRequest
        {
            FirstName = "Ada",
            LastName = "Lovelace",
            Email = "ada@example.com",
            DateOfBirth = new DateTime(1995, 1, 1)
        };

        var act = () => sut.UpdateAsync(Guid.NewGuid(), request);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task UpdateAsync_UpdatesAndCommits_WhenStudentExists()
    {
        var student = new Student
        {
            FirstName = "Old",
            LastName = "Name",
            Email = "old@example.com",
            EnrollmentNumber = "STU-2026-000001",
            DateOfBirth = new DateTime(1990, 1, 1)
        };

        _studentRepositoryMock.Setup(r => r.GetByIdAsync(student.Id, It.IsAny<CancellationToken>())).ReturnsAsync(student);
        _studentRepositoryMock.Setup(r => r.EmailExistsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(false);

        var sut = CreateSut();
        var request = new UpdateStudentRequest
        {
            FirstName = "New",
            LastName = "Name",
            Email = "new-email@example.com",
            DateOfBirth = new DateTime(1990, 1, 1)
        };

        var result = await sut.UpdateAsync(student.Id, request);

        result.FirstName.Should().Be("New");
        result.Email.Should().Be("new-email@example.com");
        _studentRepositoryMock.Verify(r => r.Update(It.Is<Student>(s => s.Id == student.Id)), Times.Once);
        _unitOfWorkMock.Verify(u => u.CommitAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeleteAsync_ThrowsNotFoundException_WhenStudentDoesNotExist()
    {
        _studentRepositoryMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>())).ReturnsAsync((Student?)null);

        var sut = CreateSut();

        var act = () => sut.DeleteAsync(Guid.NewGuid());

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task DeleteAsync_RemovesAndCommits_WhenStudentExists()
    {
        var student = new Student
        {
            FirstName = "Ada",
            LastName = "Lovelace",
            Email = "ada@example.com",
            EnrollmentNumber = "STU-2026-000002",
            DateOfBirth = new DateTime(1990, 1, 1)
        };

        _studentRepositoryMock.Setup(r => r.GetByIdAsync(student.Id, It.IsAny<CancellationToken>())).ReturnsAsync(student);

        var sut = CreateSut();

        await sut.DeleteAsync(student.Id);

        _studentRepositoryMock.Verify(r => r.Remove(student), Times.Once);
        _unitOfWorkMock.Verify(u => u.CommitAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetByIdAsync_ThrowsNotFoundException_WhenStudentDoesNotExist()
    {
        _studentRepositoryMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>())).ReturnsAsync((Student?)null);

        var sut = CreateSut();

        var act = () => sut.GetByIdAsync(Guid.NewGuid());

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task GetPagedAsync_ReturnsMappedPagedResult()
    {
        var students = new List<Student>
        {
            new() { FirstName = "A", LastName = "One", Email = "a@example.com", EnrollmentNumber = "STU-2026-000010", DateOfBirth = new DateTime(1990, 1, 1) },
            new() { FirstName = "B", LastName = "Two", Email = "b@example.com", EnrollmentNumber = "STU-2026-000011", DateOfBirth = new DateTime(1991, 1, 1) }
        };

        _studentRepositoryMock
            .Setup(r => r.GetPagedAsync(
                1, 10,
                It.IsAny<System.Linq.Expressions.Expression<Func<Student, bool>>?>(),
                It.IsAny<Func<IQueryable<Student>, IOrderedQueryable<Student>>?>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((students, students.Count));

        var sut = CreateSut();
        var result = await sut.GetPagedAsync(new PagedRequest { PageNumber = 1, PageSize = 10 });

        result.TotalCount.Should().Be(2);
        result.Items.Should().HaveCount(2);
        result.Items.Select(i => i.Email).Should().Contain(new[] { "a@example.com", "b@example.com" });
    }
}
