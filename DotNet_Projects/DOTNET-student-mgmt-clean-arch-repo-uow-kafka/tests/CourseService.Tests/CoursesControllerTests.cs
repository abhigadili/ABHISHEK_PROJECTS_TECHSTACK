using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using StudentMgmt.BuildingBlocks.Contracts.Common;
using StudentMgmt.CourseService.Controllers;
using StudentMgmt.CourseService.DTOs.Requests;
using StudentMgmt.CourseService.DTOs.Responses;
using StudentMgmt.CourseService.Services.Interfaces;
using Xunit;

namespace StudentMgmt.CourseService.Tests;

public class CoursesControllerTests
{
    private readonly Mock<ICourseAppService> _appServiceMock = new();
    private readonly CoursesController _sut;

    public CoursesControllerTests()
    {
        _sut = new CoursesController(_appServiceMock.Object);
    }

    private static CourseResponse SampleResponse(Guid id) => new()
    {
        Id = id,
        CourseCode = "CS101",
        Title = "Introduction to Computer Science",
        Description = "A foundational course.",
        Credits = 3,
        Capacity = 30,
        InstructorName = "Dr. Ada Lovelace",
        IsActive = true,
        CreatedDate = DateTime.UtcNow
    };

    [Fact]
    public async Task CreateAsync_ReturnsCreatedAtAction_WithSuccessfulApiResponse()
    {
        var id = Guid.NewGuid();
        var request = new CreateCourseRequest
        {
            CourseCode = "CS101",
            Title = "Introduction to Computer Science",
            Description = "A foundational course.",
            Credits = 3,
            Capacity = 30,
            InstructorName = "Dr. Ada Lovelace"
        };
        _appServiceMock.Setup(s => s.CreateAsync(request, It.IsAny<CancellationToken>())).ReturnsAsync(SampleResponse(id));

        var actionResult = await _sut.CreateAsync(request, CancellationToken.None);

        var createdResult = actionResult.Result.Should().BeOfType<CreatedResult>().Subject;
        createdResult.Location.Should().Be($"/api/v1/courses/{id}");
        var response = createdResult.Value.Should().BeOfType<ApiResponse<CourseResponse>>().Subject;
        response.Success.Should().BeTrue();
        response.Data!.CourseCode.Should().Be("CS101");
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsOk_WithSuccessfulApiResponse()
    {
        var id = Guid.NewGuid();
        _appServiceMock.Setup(s => s.GetByIdAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync(SampleResponse(id));

        var actionResult = await _sut.GetByIdAsync(id, CancellationToken.None);

        var okResult = actionResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<ApiResponse<CourseResponse>>().Subject;
        response.Success.Should().BeTrue();
        response.Data!.Id.Should().Be(id);
    }

    [Fact]
    public async Task GetPagedAsync_ReturnsOk_WithPagedResult()
    {
        var pagedResult = PagedResult<CourseResponse>.Create(
            new List<CourseResponse> { SampleResponse(Guid.NewGuid()), SampleResponse(Guid.NewGuid()) },
            pageNumber: 1,
            pageSize: 10,
            totalCount: 2);

        _appServiceMock
            .Setup(s => s.GetPagedAsync(It.IsAny<PagedRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(pagedResult);

        var actionResult = await _sut.GetPagedAsync(new PagedRequest(), CancellationToken.None);

        var okResult = actionResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<ApiResponse<PagedResult<CourseResponse>>>().Subject;
        response.Success.Should().BeTrue();
        response.Data!.Items.Should().HaveCount(2);
        response.Data.TotalCount.Should().Be(2);
    }

    [Fact]
    public async Task UpdateAsync_ReturnsOk_WithSuccessfulApiResponse()
    {
        var id = Guid.NewGuid();
        var request = new UpdateCourseRequest
        {
            CourseCode = "CS101",
            Title = "Updated Title",
            Description = "Updated description.",
            Credits = 4,
            Capacity = 35,
            InstructorName = "Dr. Ada Lovelace"
        };
        var updated = SampleResponse(id);
        updated.Title = "Updated Title";
        _appServiceMock.Setup(s => s.UpdateAsync(id, request, It.IsAny<CancellationToken>())).ReturnsAsync(updated);

        var actionResult = await _sut.UpdateAsync(id, request, CancellationToken.None);

        var okResult = actionResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<ApiResponse<CourseResponse>>().Subject;
        response.Success.Should().BeTrue();
        response.Data!.Title.Should().Be("Updated Title");
    }

    [Fact]
    public async Task DeleteAsync_ReturnsOk_WithSuccessfulApiResponse()
    {
        var id = Guid.NewGuid();
        _appServiceMock.Setup(s => s.DeleteAsync(id, It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var actionResult = await _sut.DeleteAsync(id, CancellationToken.None);

        var okResult = actionResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<ApiResponse<object>>().Subject;
        response.Success.Should().BeTrue();
        _appServiceMock.Verify(s => s.DeleteAsync(id, It.IsAny<CancellationToken>()), Times.Once);
    }
}
