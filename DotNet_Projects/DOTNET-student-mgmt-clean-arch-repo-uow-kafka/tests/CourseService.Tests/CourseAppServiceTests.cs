using AutoMapper;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StudentMgmt.BuildingBlocks.Common.Exceptions;
using StudentMgmt.BuildingBlocks.Messaging;
using StudentMgmt.CourseService.DTOs.Requests;
using StudentMgmt.CourseService.Entities;
using StudentMgmt.CourseService.Kafka.Producers;
using StudentMgmt.CourseService.Mappings;
using StudentMgmt.CourseService.Repositories.Interfaces;
using StudentMgmt.CourseService.Services;
using StudentMgmt.CourseService.UnitOfWork;
using StudentMgmt.CourseService.Validators;
using Xunit;

namespace StudentMgmt.CourseService.Tests;

public class CourseAppServiceTests
{
    private readonly Mock<ICourseUnitOfWork> _unitOfWorkMock = new();
    private readonly Mock<ICourseRepository> _repositoryMock = new();
    private readonly Mock<IEventProducer> _eventProducerMock = new();
    private readonly IMapper _mapper;
    private readonly CourseAppService _sut;

    public CourseAppServiceTests()
    {
        _unitOfWorkMock.Setup(u => u.Courses).Returns(_repositoryMock.Object);

        var mapperConfig = new MapperConfiguration(cfg => cfg.AddProfile<CourseProfile>());
        _mapper = mapperConfig.CreateMapper();

        var eventPublisher = new CourseEventPublisher(_eventProducerMock.Object);

        _sut = new CourseAppService(
            _unitOfWorkMock.Object,
            _mapper,
            new CreateCourseRequestValidator(),
            new UpdateCourseRequestValidator(),
            eventPublisher,
            NullLogger<CourseAppService>.Instance);
    }

    private static CreateCourseRequest ValidCreateRequest(string courseCode = "CS101") => new()
    {
        CourseCode = courseCode,
        Title = "Introduction to Computer Science",
        Description = "A foundational course covering programming basics.",
        Credits = 3,
        Capacity = 30,
        InstructorName = "Dr. Ada Lovelace"
    };

    private static Course ExistingCourse(Guid id, string courseCode = "CS101") => new()
    {
        Id = id,
        CourseCode = courseCode,
        Title = "Introduction to Computer Science",
        Description = "A foundational course covering programming basics.",
        Credits = 3,
        Capacity = 30,
        InstructorName = "Dr. Ada Lovelace",
        IsActive = true
    };

    [Fact]
    public async Task CreateAsync_WhenCourseCodeAlreadyExists_ThrowsBusinessRuleException()
    {
        _repositoryMock
            .Setup(r => r.CourseCodeExistsAsync("CS101", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var act = async () => await _sut.CreateAsync(ValidCreateRequest());

        await act.Should().ThrowAsync<BusinessRuleException>();
        _repositoryMock.Verify(r => r.AddAsync(It.IsAny<Course>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CreateAsync_WhenCourseCodeIsUnique_AddsCourseAndPublishesEvent()
    {
        _repositoryMock
            .Setup(r => r.CourseCodeExistsAsync("CS101", It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var result = await _sut.CreateAsync(ValidCreateRequest());

        result.CourseCode.Should().Be("CS101");
        result.IsActive.Should().BeTrue();
        _repositoryMock.Verify(r => r.AddAsync(It.Is<Course>(c => c.CourseCode == "CS101"), It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWorkMock.Verify(u => u.CommitAsync(It.IsAny<CancellationToken>()), Times.Once);
        _eventProducerMock.Verify(p => p.PublishAsync(
            StudentMgmt.BuildingBlocks.Contracts.KafkaTopics.CourseCreated,
            It.IsAny<StudentMgmt.BuildingBlocks.Contracts.Events.CourseCreatedEvent>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetByIdAsync_WhenCourseDoesNotExist_ThrowsNotFoundException()
    {
        var id = Guid.NewGuid();
        _repositoryMock
            .Setup(r => r.GetByIdAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Course?)null);

        var act = async () => await _sut.GetByIdAsync(id);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task GetByIdAsync_WhenCourseExists_ReturnsMappedResponse()
    {
        var id = Guid.NewGuid();
        var course = ExistingCourse(id);
        _repositoryMock
            .Setup(r => r.GetByIdAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(course);

        var result = await _sut.GetByIdAsync(id);

        result.Id.Should().Be(id);
        result.CourseCode.Should().Be("CS101");
    }

    [Fact]
    public async Task UpdateAsync_WhenCourseExistsAndCodeIsUnchanged_UpdatesAndCommits()
    {
        var id = Guid.NewGuid();
        var course = ExistingCourse(id);
        _repositoryMock
            .Setup(r => r.GetByIdAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(course);
        _repositoryMock
            .Setup(r => r.GetByCourseCodeAsync("CS101", It.IsAny<CancellationToken>()))
            .ReturnsAsync(course);

        var request = new UpdateCourseRequest
        {
            CourseCode = "CS101",
            Title = "Intro to CS (Updated)",
            Description = "Updated description.",
            Credits = 4,
            Capacity = 40,
            InstructorName = "Dr. Ada Lovelace"
        };

        var result = await _sut.UpdateAsync(id, request);

        result.Title.Should().Be("Intro to CS (Updated)");
        result.Credits.Should().Be(4);
        _repositoryMock.Verify(r => r.Update(It.Is<Course>(c => c.Id == id && c.Title == "Intro to CS (Updated)")), Times.Once);
        _unitOfWorkMock.Verify(u => u.CommitAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateAsync_WhenNewCodeBelongsToAnotherCourse_ThrowsBusinessRuleException()
    {
        var id = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        var course = ExistingCourse(id, "CS101");
        var otherCourse = ExistingCourse(otherId, "CS202");

        _repositoryMock
            .Setup(r => r.GetByIdAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(course);
        _repositoryMock
            .Setup(r => r.GetByCourseCodeAsync("CS202", It.IsAny<CancellationToken>()))
            .ReturnsAsync(otherCourse);

        var request = new UpdateCourseRequest
        {
            CourseCode = "CS202",
            Title = course.Title,
            Description = course.Description,
            Credits = course.Credits,
            Capacity = course.Capacity,
            InstructorName = course.InstructorName
        };

        var act = async () => await _sut.UpdateAsync(id, request);

        await act.Should().ThrowAsync<BusinessRuleException>();
        _repositoryMock.Verify(r => r.Update(It.IsAny<Course>()), Times.Never);
    }

    [Fact]
    public async Task UpdateAsync_WhenCourseDoesNotExist_ThrowsNotFoundException()
    {
        var id = Guid.NewGuid();
        _repositoryMock
            .Setup(r => r.GetByIdAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Course?)null);

        var act = async () => await _sut.UpdateAsync(id, ValidCreateRequestAsUpdate());

        await act.Should().ThrowAsync<NotFoundException>();

        static UpdateCourseRequest ValidCreateRequestAsUpdate() => new()
        {
            CourseCode = "CS101",
            Title = "Introduction to Computer Science",
            Description = "A foundational course covering programming basics.",
            Credits = 3,
            Capacity = 30,
            InstructorName = "Dr. Ada Lovelace"
        };
    }

    [Fact]
    public async Task DeleteAsync_WhenCourseExists_RemovesCommitsAndPublishesEvent()
    {
        var id = Guid.NewGuid();
        var course = ExistingCourse(id);
        _repositoryMock
            .Setup(r => r.GetByIdAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(course);

        await _sut.DeleteAsync(id);

        _repositoryMock.Verify(r => r.Remove(course), Times.Once);
        _unitOfWorkMock.Verify(u => u.CommitAsync(It.IsAny<CancellationToken>()), Times.Once);
        _eventProducerMock.Verify(p => p.PublishAsync(
            StudentMgmt.BuildingBlocks.Contracts.KafkaTopics.CourseDeleted,
            It.IsAny<StudentMgmt.BuildingBlocks.Contracts.Events.CourseDeletedEvent>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeleteAsync_WhenCourseDoesNotExist_ThrowsNotFoundException()
    {
        var id = Guid.NewGuid();
        _repositoryMock
            .Setup(r => r.GetByIdAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Course?)null);

        var act = async () => await _sut.DeleteAsync(id);

        await act.Should().ThrowAsync<NotFoundException>();
        _repositoryMock.Verify(r => r.Remove(It.IsAny<Course>()), Times.Never);
    }
}
