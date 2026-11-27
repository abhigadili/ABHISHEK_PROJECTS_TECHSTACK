using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using StudentMgmt.BuildingBlocks.Contracts.Common;
using StudentMgmt.EnrollmentService.Controllers;
using StudentMgmt.EnrollmentService.DTOs.Requests;
using StudentMgmt.EnrollmentService.DTOs.Responses;
using StudentMgmt.EnrollmentService.Entities;
using StudentMgmt.EnrollmentService.Services.Interfaces;
using Xunit;

namespace EnrollmentService.Tests;

public class EnrollmentsControllerTests
{
    private readonly Mock<IEnrollmentAppService> _appServiceMock = new();
    private readonly EnrollmentsController _sut;

    public EnrollmentsControllerTests()
    {
        _sut = new EnrollmentsController(_appServiceMock.Object);
    }

    private static EnrollmentResponse MakeResponse() => new()
    {
        Id = Guid.NewGuid(),
        StudentId = Guid.NewGuid(),
        StudentFullName = "Ada Lovelace",
        CourseId = Guid.NewGuid(),
        CourseTitle = "Intro to Algorithms",
        Status = EnrollmentStatus.Confirmed,
        EnrolledOnUtc = DateTime.UtcNow
    };

    [Fact]
    public async Task Enroll_ReturnsOkWithSuccessfulApiResponse()
    {
        var expected = MakeResponse();
        _appServiceMock.Setup(s => s.EnrollAsync(It.IsAny<EnrollStudentRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);

        var actionResult = await _sut.Enroll(new EnrollStudentRequest { StudentId = expected.StudentId, CourseId = expected.CourseId }, CancellationToken.None);

        var okResult = actionResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var body = okResult.Value.Should().BeOfType<ApiResponse<EnrollmentResponse>>().Subject;
        body.Success.Should().BeTrue();
        body.Data.Should().Be(expected);
    }

    [Fact]
    public async Task Cancel_ReturnsOkWithSuccessfulApiResponse()
    {
        var expected = MakeResponse();
        expected.Status = EnrollmentStatus.Cancelled;
        _appServiceMock.Setup(s => s.CancelAsync(expected.Id, It.IsAny<CancelEnrollmentRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);

        var actionResult = await _sut.Cancel(expected.Id, new CancelEnrollmentRequest { Reason = "Test" }, CancellationToken.None);

        var okResult = actionResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var body = okResult.Value.Should().BeOfType<ApiResponse<EnrollmentResponse>>().Subject;
        body.Success.Should().BeTrue();
        body.Data!.Status.Should().Be(EnrollmentStatus.Cancelled);
    }

    [Fact]
    public async Task GetHistory_ReturnsOkWithListOfEnrollments()
    {
        var studentId = Guid.NewGuid();
        var expected = new List<EnrollmentResponse> { MakeResponse(), MakeResponse() };
        _appServiceMock.Setup(s => s.GetHistoryAsync(studentId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);

        var actionResult = await _sut.GetHistory(studentId, CancellationToken.None);

        var okResult = actionResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var body = okResult.Value.Should().BeOfType<ApiResponse<IReadOnlyList<EnrollmentResponse>>>().Subject;
        body.Success.Should().BeTrue();
        body.Data.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetStatus_ReturnsOkWithSingleEnrollment()
    {
        var expected = MakeResponse();
        _appServiceMock.Setup(s => s.GetStatusAsync(expected.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);

        var actionResult = await _sut.GetStatus(expected.Id, CancellationToken.None);

        var okResult = actionResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var body = okResult.Value.Should().BeOfType<ApiResponse<EnrollmentResponse>>().Subject;
        body.Data.Should().Be(expected);
    }

    [Fact]
    public async Task GetPaged_ReturnsOkWithPagedResult()
    {
        var pagedResult = PagedResult<EnrollmentResponse>.Create(new[] { MakeResponse() }, 1, 10, 1);
        _appServiceMock.Setup(s => s.GetPagedAsync(It.IsAny<PagedRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(pagedResult);

        var actionResult = await _sut.GetPaged(new PagedRequest(), CancellationToken.None);

        var okResult = actionResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var body = okResult.Value.Should().BeOfType<ApiResponse<PagedResult<EnrollmentResponse>>>().Subject;
        body.Data!.TotalCount.Should().Be(1);
    }
}
